import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  console.log('=== Starting email send process ===');
  
  try {
    const body = await request.json();
    const { businessId, template = 'website_ready' } = body;

    if (!businessId) {
      console.error('❌ No businessId provided');
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    // 1. Get business data from Supabase
    console.log(`📋 Fetching business data for ID: ${businessId}`);
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      console.error('❌ Business not found:', businessError);
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Found business: ${business.business_name}`);
    console.log(`📧 Preparing to send email to: ${business.email}`);

    // 2. Get preview URL
    const { data: preview, error: previewError } = await supabase
      .from('website_previews')
      .select('preview_url, slug')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (previewError || !preview) {
      console.error('❌ Preview not found:', previewError);
      return NextResponse.json(
        { success: false, error: 'Preview not found' },
        { status: 404 }
      );
    }

    console.log('🔗 Preview URL:', preview.preview_url);

    // 3. Actually send email via Resend
    console.log('📤 Sending email via Resend...');
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .button:hover { background: #5a67d8; }
            .preview-box { background: #f7f7f7; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .price { font-size: 24px; color: #667eea; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Your Professional Website is Ready!</h1>
            </div>
            <div class="content">
              <h2>Hi ${business.business_name},</h2>
              <p>Great news! We've created a stunning, professional website for your business that's ready to help you attract more customers.</p>
              
              <div class="preview-box">
                <h3>✨ Your Website Features:</h3>
                <ul>
                  <li>Professional design tailored to your business</li>
                  <li>Mobile-responsive layout</li>
                  <li>Contact information prominently displayed</li>
                  <li>SEO-optimized for local searches</li>
                  <li>Fast loading speed</li>
                </ul>
              </div>
              
              <div style="text-align: center;">
                <a href="${preview.preview_url}" class="button">View Your Website →</a>
              </div>
              
              <div class="preview-box" style="text-align: center;">
                <p>Claim your website now for only</p>
                <p class="price">$150/year</p>
                <p style="color: #666;">That's less than $13/month for a professional online presence!</p>
              </div>
              
              <h3>Why claim your website today?</h3>
              <ul>
                <li><strong>Instant activation</strong> - Your website goes live immediately</li>
                <li><strong>Custom domain</strong> - Get your own professional web address</li>
                <li><strong>Free updates</strong> - Keep your information current</li>
                <li><strong>Support included</strong> - We're here to help you succeed</li>
              </ul>
              
              <p>Don't miss out on potential customers searching for your business online!</p>
              
              <div style="text-align: center;">
                <a href="${preview.preview_url}" class="button">Claim Your Website Now →</a>
              </div>
            </div>
            <div class="footer">
              <p>© 2024 WebInstant. All rights reserved.</p>
              <p>Questions? Reply to this email and we'll be happy to help!</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResult = await resend.emails.send({
      from: 'WebInstant <noreply@webinstant.io>',
      to: business.email,
      subject: `${business.business_name}, your website is ready! 🎉`,
      html: emailHtml
    });

    console.log('✅ Email sent successfully via Resend:', emailResult);

    // 4. Log to database - using email_logs table
    const logEntry = {
      business_id: businessId,
      email_type: template,
      recipient_email: business.email,
      status: 'sent',
      email_sent_at: new Date().toISOString(),
      subject: `${business.business_name}, your website is ready! 🎉`,
      message_id: emailResult.data?.id || null,
      preview_url: preview.preview_url
    };

    console.log('📝 Logging email to database...');
    const { error: logError } = await supabase
      .from('email_logs')
      .insert([logEntry]);

    if (logError) {
      console.error('⚠️ Failed to log email (non-critical):', logError);
    } else {
      console.log('✅ Email logged to database');
    }

    // 5. Log to operations_log
    const { error: opsLogError } = await supabase
      .from('operations_log')
      .insert({
        operation_type: 'email_sent',
        status: 'success',
        message: `Email sent to ${business.business_name} (${business.email})`,
        details: {
          business_id: businessId,
          email: business.email,
          resend_id: emailResult.data?.id,
          template: template
        }
      });

    if (opsLogError) {
      console.error('⚠️ Failed to log operation (non-critical):', opsLogError);
    }

    console.log('🎉 Email process completed successfully');
    
    return NextResponse.json({ 
      success: true, 
      emailId: emailResult.data?.id,
      message: 'Email sent successfully',
      recipient: business.email,
      businessName: business.business_name,
      previewUrl: preview.preview_url
    });

  } catch (error) {
    console.error('❌ Error in send-email:', error);
    
    // Log failure to operations_log
    try {
      await supabase
        .from('operations_log')
        .insert({
          operation_type: 'email_sent',
          status: 'error',
          message: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { error: error instanceof Error ? error.message : error }
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send email' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Get email statistics
  try {
    const { data: stats, error } = await supabase
      .from('email_logs')
      .select('status, email_type')
      .order('email_sent_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({
        message: 'Email sending endpoint',
        status: 'ready',
        stats: { error: error.message }
      });
    }

    const summary = {
      total: stats?.length || 0,
      sent: stats?.filter(s => s.status === 'sent').length || 0,
      failed: stats?.filter(s => s.status === 'failed').length || 0,
      byType: stats?.reduce((acc: any, s) => {
        acc[s.email_type] = (acc[s.email_type] || 0) + 1;
        return acc;
      }, {})
    };

    return NextResponse.json({
      message: 'Email sending endpoint',
      status: 'ready',
      method: 'POST',
      requiredFields: ['businessId'],
      optionalFields: ['template'],
      stats: summary,
      info: {
        resendConfigured: !!process.env.RESEND_API_KEY,
        fromEmail: 'noreply@webinstant.io'
      }
    });
  } catch (error) {
    return NextResponse.json({
      message: 'Email sending endpoint',
      status: 'ready',
      error: 'Failed to get stats'
    });
  }
}
