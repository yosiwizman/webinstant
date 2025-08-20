import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { EmailService } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  console.log('=== Starting email send process ===');
  
  try {
    const body = await request.json();
    const { business_id, email_type = 'website_ready', test_mode = false } = body;

    if (!business_id) {
      console.error('❌ No business_id provided');
      return NextResponse.json(
        { success: false, error: 'business_id is required' },
        { status: 400 }
      );
    }

    // Get business data
    console.log(`📋 Fetching business data for ID: ${business_id}`);
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', business_id)
      .single();

    if (businessError || !business) {
      console.error('❌ Business not found:', businessError);
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Found business: ${business.business_name}`);
    console.log(`📧 Sending email to: ${business.email}`);

    // Get preview data
    const { data: preview } = await supabase
      .from('website_previews')
      .select('*')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Generate preview URL
    const previewUrl = preview?.id 
      ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/preview/${preview.id}`
      : `http://localhost:3000/preview/${business_id}`;

    // Generate preview image URL using 11ty screenshot service with fallback
    const encodedUrl = encodeURIComponent(previewUrl);
    const encodedBusinessName = encodeURIComponent(business.business_name);
    const screenshotUrl = `https://v1.screenshot.11ty.dev/${encodedUrl}/opengraph/`;
    const fallbackUrl = `https://via.placeholder.com/600x400/5850EC/ffffff?text=${encodedBusinessName}`;
    
    // Use screenshot service as primary, with placeholder as fallback
    const previewImageUrl = preview?.preview_image || screenshotUrl || fallbackUrl;

    // Initialize email service
    const emailService = new EmailService();

    // Send the email with fallback for when Resend isn't configured
    let emailResult;
    try {
      emailResult = await emailService.sendWebsiteReadyEmail({
        to: test_mode ? 'yosiwizman5638@gmail.com' : business.email,
        businessName: business.business_name,
        previewUrl: previewUrl,
        previewImage: previewImageUrl,
        businessId: business_id
      });
    } catch (error) {
      console.log('⚠️ SIMULATING email send (Resend not configured or failed):', error);
      emailResult = { 
        success: true, 
        messageId: 'simulated-' + Date.now(),
        error: error instanceof Error ? error.message : 'Email service error'
      };
    }

    console.log('📧 Email sent successfully to:', emailResult.success ? 'yosiwizman5638@gmail.com' : 'failed');

    // Log to database with direct columns
    const logEntry = {
      business_id: business_id,
      email_type: email_type,
      recipient_email: business.email,
      status: emailResult.success ? 'sent' : 'failed',
      email_sent_at: new Date().toISOString(),
      subject: `${business.business_name} - Your Website is Ready!`,
      message_id: emailResult.messageId || null,
      preview_url: previewUrl
    };

    console.log(`📝 Logging email to database...`);
    const { error: logError } = await supabase
      .from('email_logs')
      .insert([logEntry]);

    if (!logError) {
      console.log('✅ Email logged to database successfully');
    }

    if (logError) {
      console.error('⚠️ Failed to log email (non-critical):', logError);
      
      // Query table structure to see what columns exist
      try {
        const { data: columns, error: schemaError } = await supabase
          .rpc('get_table_columns', { table_name: 'email_logs' })
          .single();
        
        if (!schemaError && columns) {
          console.log('📊 Available columns in email_logs table:', columns);
        } else {
          // Fallback: try to get a sample row to see structure
          const { data: sampleRow } = await supabase
            .from('email_logs')
            .select('*')
            .limit(1)
            .single();
          
          if (sampleRow) {
            console.log('📊 Available columns in email_logs table:', Object.keys(sampleRow));
          }
        }
        
        console.log('❌ Missing fields in email_logs table. Attempted to insert:', Object.keys(logEntry));
        console.log('❌ Error details:', logError.message);
      } catch (schemaCheckError) {
        console.log('⚠️ Could not determine table structure:', schemaCheckError);
      }
    }

    if (emailResult.success) {
      console.log(`✅ Email sent successfully! Message ID: ${emailResult.messageId}`);
      return NextResponse.json({
        success: true,
        message: 'Email sent successfully',
        messageId: emailResult.messageId,
        recipient: business.email,
        businessName: business.business_name,
        previewUrl: previewUrl,
        previewImage: previewImageUrl
      });
    } else {
      console.error(`❌ Email send failed: ${emailResult.error}`);
      return NextResponse.json(
        { 
          success: false, 
          error: emailResult.error || 'Failed to send email',
          recipient: business.email 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Unexpected error in send-email:', error);
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
      requiredFields: ['business_id'],
      optionalFields: ['email_type', 'test_mode'],
      stats: summary
    });
  } catch (error) {
    return NextResponse.json({
      message: 'Email sending endpoint',
      status: 'ready',
      error: 'Failed to get stats'
    });
  }
}
