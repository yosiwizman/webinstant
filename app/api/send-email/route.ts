import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

export async function POST(request: NextRequest) {
  console.log('=== Starting email send process ===');
  console.log('Environment:', isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION');
  
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
    console.log(`📧 Original email address: ${business.email}`);

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

    // 3. Prepare email details with development mode override
    const originalEmail = business.email;
    const recipient = isDevelopment ? 'yosiwizman5638@gmail.com' : originalEmail;
    const originalSubject = `${business.business_name}, your website is ready! 🎉`;
    const subject = isDevelopment 
      ? `[TEST for ${originalEmail}] ${originalSubject}`
      : originalSubject;

    console.log('Email attempt:', {
      originalRecipient: originalEmail,
      actualRecipient: recipient,
      subject: subject,
      isDevelopment: isDevelopment
    });

    if (isDevelopment) {
      console.log('⚠️ DEVELOPMENT MODE: Redirecting email to test address');
    }

    // 4. Actually send email via Resend
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
            .dev-notice { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            ${isDevelopment ? `
            <div class="dev-notice">
              <strong>⚠️ DEVELOPMENT MODE</strong><br>
              This email was intended for: ${originalEmail}<br>
              Business: ${business.business_name}
            </div>
            ` : ''}
            <div class="header">
              <h1>🎉 Your Professional Website is Ready!</h1>
            </div>
            <div class="content">
              <h2>Hi ${business.business_name},</h2>
              <p>Great news! We&apos;ve created a stunning, professional website for your business that&apos;s ready to help you attract more customers.</p>
              
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
                <p style="color: #666;">That&apos;s less than $13/month for a professional online presence!</p>
              </div>
              
              <h3>Why claim your website today?</h3>
              <ul>
                <li><strong>Instant activation</strong> - Your website goes live immediately</li>
                <li><strong>Custom domain</strong> - Get your own professional web address</li>
                <li><strong>Free updates</strong> - Keep your information current</li>
                <li><strong>Support included</strong> - We&apos;re here to help you succeed</li>
              </ul>
              
              <p>Don&apos;t miss out on potential customers searching for your business online!</p>
              
              <div style="text-align: center;">
                <a href="${preview.preview_url}" class="button">Claim Your Website Now →</a>
              </div>
            </div>
            <div class="footer">
              <p>© 2024 WebInstant. All rights reserved.</p>
              <p>Questions? Reply to this email and we&apos;ll be happy to help!</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
${isDevelopment ? `⚠️ DEVELOPMENT MODE - Intended for: ${originalEmail}\n\n` : ''}
${business.business_name}, your website is ready!

Great news! We've created a stunning, professional website for your business that's ready to help you attract more customers.

View your website: ${preview.preview_url}

Your Website Features:
• Professional design tailored to your business
• Mobile-responsive layout
• Contact information prominently displayed
• SEO-optimized for local searches
• Fast loading speed

Claim your website now for only $150/year
That's less than $13/month for a professional online presence!

Why claim your website today?
• Instant activation - Your website goes live immediately
• Custom domain - Get your own professional web address
• Free updates - Keep your information current
• Support included - We're here to help you succeed

Don't miss out on potential customers searching for your business online!

Claim Your Website Now: ${preview.preview_url}

© 2024 WebInstant. All rights reserved.
Questions? Reply to this email and we'll be happy to help!
    `.trim();

    try {
      const emailResult = await resend.emails.send({
        from: 'WebInstant <onboarding@resend.dev>',
        to: [recipient],
        subject: subject,
        html: emailHtml,
        text: textContent
      });

      console.log('✅ Email sent successfully via Resend:', emailResult);

      // 5. Log to database - using email_logs table
      const logEntry = {
        business_id: businessId,
        email_type: template,
        recipient_email: originalEmail, // Always log the original email
        status: 'sent',
        email_sent_at: new Date().toISOString(),
        subject: originalSubject, // Log the original subject
        message_id: emailResult.data?.id || null,
        preview_url: preview.preview_url,
        metadata: isDevelopment ? { 
          development_mode: true, 
          actual_recipient: recipient 
        } : null
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

      // 6. Log to operations_log
      const { error: opsLogError } = await supabase
        .from('operations_log')
        .insert({
          operation_type: 'email_sent',
          status: 'success',
          message: `Email sent to ${business.business_name} (${isDevelopment ? `TEST: ${recipient}` : originalEmail})`,
          details: {
            business_id: businessId,
            original_email: originalEmail,
            actual_recipient: recipient,
            resend_id: emailResult.data?.id,
            template: template,
            is_development: isDevelopment
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
        recipient: recipient,
        originalRecipient: originalEmail,
        businessName: business.business_name,
        previewUrl: preview.preview_url,
        note: isDevelopment ? 'Development mode: Email sent to test address yosiwizman5638@gmail.com' : undefined
      });

    } catch (resendError) {
      console.error('Resend error:', resendError);
      
      // Log failure to database
      const logEntry = {
        business_id: businessId,
        email_type: template,
        recipient_email: originalEmail,
        status: 'failed',
        email_sent_at: new Date().toISOString(),
        subject: originalSubject,
        error_message: resendError instanceof Error ? resendError.message : 'Unknown error',
        preview_url: preview.preview_url,
        metadata: isDevelopment ? { 
          development_mode: true, 
          attempted_recipient: recipient 
        } : null
      };

      await supabase
        .from('email_logs')
        .insert([logEntry]);

      await supabase
        .from('operations_log')
        .insert({
          operation_type: 'email_sent',
          status: 'error',
          message: `Failed to send email: ${resendError instanceof Error ? resendError.message : 'Unknown error'}`,
          details: { 
            error: resendError instanceof Error ? resendError.message : resendError,
            business_id: businessId,
            original_email: originalEmail,
            attempted_recipient: recipient,
            is_development: isDevelopment
          }
        });

      return NextResponse.json({ 
        success: false, 
        error: resendError instanceof Error ? resendError.message : 'Failed to send email',
        note: isDevelopment ? 'In dev mode, emails only send to yosiwizman5638@gmail.com' : ''
      }, { status: 500 });
    }

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
          details: { 
            error: error instanceof Error ? error.message : error,
            is_development: isDevelopment
          }
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send email',
        note: isDevelopment ? 'In dev mode, emails only send to yosiwizman5638@gmail.com' : ''
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
        environment: isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION',
        stats: { error: error.message }
      });
    }

    interface StatAccumulator {
      [key: string]: number;
    }

    const summary = {
      total: stats?.length || 0,
      sent: stats?.filter(s => s.status === 'sent').length || 0,
      failed: stats?.filter(s => s.status === 'failed').length || 0,
      byType: stats?.reduce((acc: StatAccumulator, s) => {
        acc[s.email_type] = (acc[s.email_type] || 0) + 1;
        return acc;
      }, {})
    };

    return NextResponse.json({
      message: 'Email sending endpoint',
      status: 'ready',
      environment: isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION',
      method: 'POST',
      requiredFields: ['businessId'],
      optionalFields: ['template'],
      stats: summary,
      info: {
        resendConfigured: !!process.env.RESEND_API_KEY,
        fromEmail: isDevelopment ? 'onboarding@resend.dev' : 'noreply@webinstant.io',
        testRecipient: isDevelopment ? 'yosiwizman5638@gmail.com' : null,
        note: isDevelopment ? 'All emails will be sent to test recipient in development mode' : null
      }
    });
  } catch {
    return NextResponse.json({
      message: 'Email sending endpoint',
      status: 'ready',
      environment: isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION',
      error: 'Failed to get stats'
    });
  }
}
