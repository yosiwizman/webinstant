import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createEmailService } from '@/lib/email';
import { createWebsiteGenerator } from '@/lib/websiteGenerator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CampaignStats {
  totalBusinesses: number;
  emailsSent: number;
  emailsFailed: number;
  previewsGenerated: number;
  previewsFailed: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const stats: CampaignStats = {
    totalBusinesses: 0,
    emailsSent: 0,
    emailsFailed: 0,
    previewsGenerated: 0,
    previewsFailed: 0,
    errors: []
  };

  try {
    const body = await request.json();
    const { batchSize = 10, testMode = false } = body;

    // Initialize services
    const emailService = createEmailService();
    const websiteGenerator = createWebsiteGenerator();

    // Get businesses without websites
    const query = supabase
      .from('businesses')
      .select('*')
      .is('website', null)
      .order('created_at', { ascending: false });

    if (testMode) {
      query.limit(3); // Only process 3 businesses in test mode
    } else {
      query.limit(batchSize);
    }

    const { data: businesses, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch businesses: ${fetchError.message}`);
    }

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({
        message: 'No businesses without websites found',
        stats
      });
    }

    stats.totalBusinesses = businesses.length;
    console.log(`Processing ${stats.totalBusinesses} businesses...`);

    // Process businesses in batches
    const emailBatch = [];

    for (const business of businesses) {
      try {
        console.log(`Generating preview for ${business.business_name}...`);
        
        // Generate website preview
        const result = await websiteGenerator.generateWebsite(business.id);
        
        if (result.success && result.previewUrl) {
          stats.previewsGenerated++;
          
          // Prepare email
          emailBatch.push({
            to: business.email,
            businessName: business.business_name,
            previewUrl: result.previewUrl,
            previewImage: result.screenshot,
            businessId: business.id
          });

          // Update business record with preview URL
          await supabase
            .from('businesses')
            .update({ 
              preview_url: result.previewUrl,
              preview_generated_at: new Date().toISOString()
            })
            .eq('id', business.id);
        } else {
          stats.previewsFailed++;
          stats.errors.push(`Failed to generate preview for ${business.business_name}: ${result.error}`);
        }
      } catch (error) {
        stats.previewsFailed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`Error processing ${business.business_name}: ${errorMessage}`);
      }
    }

    // Send emails in batch
    if (emailBatch.length > 0) {
      console.log(`Sending ${emailBatch.length} emails...`);
      
      const emailResults = await emailService.sendBatch(emailBatch);
      stats.emailsSent = emailResults.sent;
      stats.emailsFailed = emailResults.failed;

      // Log campaign results
      await supabase.from('campaign_logs').insert({
        campaign_type: 'website_ready',
        businesses_processed: stats.totalBusinesses,
        emails_sent: stats.emailsSent,
        emails_failed: stats.emailsFailed,
        previews_generated: stats.previewsGenerated,
        previews_failed: stats.previewsFailed,
        errors: stats.errors,
        created_at: new Date().toISOString()
      });

      // Update businesses with email sent status
      for (const result of emailResults.results) {
        if (result.success) {
          const business = emailBatch.find(e => e.to === result.email);
          if (business) {
            await supabase
              .from('businesses')
              .update({ 
                email_sent: true,
                email_sent_at: new Date().toISOString(),
                email_message_id: result.messageId
              })
              .eq('id', business.businessId);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign sent successfully',
      stats
    });

  } catch (error) {
    console.error('Campaign error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send campaign',
        details: error instanceof Error ? error.message : 'Unknown error',
        stats
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get campaign statistics
    const { data: recentCampaigns, error } = await supabase
      .from('campaign_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    // Get overall statistics
    const { count: totalBusinesses } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true });

    const { count: businessesWithoutWebsites } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .is('website', null);

    const { count: emailsSent } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('email_sent', true);

    return NextResponse.json({
      message: 'Campaign endpoint ready',
      stats: {
        totalBusinesses,
        businessesWithoutWebsites,
        emailsSent,
        recentCampaigns: recentCampaigns || []
      },
      endpoints: {
        POST: {
          description: 'Send website ready campaign',
          params: {
            batchSize: 'number (optional) - Number of businesses to process (default: 10)',
            testMode: 'boolean (optional) - Run in test mode with only 3 businesses (default: false)'
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign statistics' },
      { status: 500 }
    );
  }
}
