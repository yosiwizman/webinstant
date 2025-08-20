import { Resend } from 'resend';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export interface EmailOptions {
  to: string;
  businessName: string;
  previewUrl: string;
  previewImage?: string;
  businessId: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BatchEmailResult {
  sent: number;
  failed: number;
  results: Array<{
    email: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

// Email template as a function that returns HTML string
function WebsiteReadyEmailTemplate({
  businessName,
  previewUrl,
  previewImage,
  trackingPixelUrl
}: {
  businessName: string;
  previewUrl: string;
  previewImage: string;
  trackingPixelUrl?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${businessName} - Your Website is Ready!</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    h1 {
      color: #2563eb;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .preview-image {
      width: 100%;
      max-width: 500px;
      height: auto;
      border-radius: 8px;
      margin: 20px 0;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 50px;
      font-weight: bold;
      font-size: 16px;
      margin: 20px 0;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
    .benefits {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .benefit-item {
      padding: 10px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .benefit-item:last-child {
      border-bottom: none;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e9ecef;
      color: #6c757d;
      font-size: 14px;
    }
    .emoji {
      font-size: 24px;
      margin-right: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Great News, ${businessName}!</h1>
      <p style="font-size: 18px; color: #6c757d;">Your professional website is ready to view!</p>
    </div>

    ${previewImage ? `
    <div style="text-align: center;">
      <img src="${previewImage}" alt="${businessName} Website Preview" style="width: 100%; max-width: 600px; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 20px 0;" />
    </div>
    ` : ''}

    <div style="text-align: center; margin: 30px 0;">
      <p style="font-size: 16px; margin-bottom: 20px;">
        We've created a stunning website for your business that's ready to attract more customers and grow your online presence.
      </p>
      <a href="${previewUrl}" class="cta-button">View Your Website Now →</a>
    </div>

    <div class="benefits">
      <h2 style="color: #2563eb; font-size: 20px; margin-bottom: 15px;">✨ What's Included:</h2>
      <div class="benefit-item">
        <span class="emoji">📱</span>
        <strong>Mobile-Optimized Design</strong> - Looks perfect on all devices
      </div>
      <div class="benefit-item">
        <span class="emoji">🔍</span>
        <strong>SEO-Ready</strong> - Built to rank well in Google searches
      </div>
      <div class="benefit-item">
        <span class="emoji">⚡</span>
        <strong>Lightning Fast</strong> - Optimized for speed and performance
      </div>
      <div class="benefit-item">
        <span class="emoji">🎨</span>
        <strong>Professional Design</strong> - Customized for your business type
      </div>
      <div class="benefit-item">
        <span class="emoji">📞</span>
        <strong>Contact Integration</strong> - Easy for customers to reach you
      </div>
    </div>

    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <h3 style="margin: 0 0 10px 0;">🚀 Ready to Go Live?</h3>
      <p style="margin: 0;">Click the button below to review your website and make any edits you'd like!</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${previewUrl}" class="cta-button">Review & Edit Your Website →</a>
    </div>

    <div class="footer">
      <p>Questions? Reply to this email and we'll be happy to help!</p>
      <p style="margin-top: 10px;">
        © ${new Date().getFullYear()} Your Website Builder. All rights reserved.
      </p>
    </div>
  </div>
  ${trackingPixelUrl ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />` : ''}
</body>
</html>
  `;
}

export class EmailService {
  private resend: Resend | null = null;
  private rateLimitDelay = 100; // 100ms between emails = 10 per second
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second initial retry delay

  constructor(apiKey?: string) {
    const key = apiKey || process.env.RESEND_API_KEY;
    
    if (!key || key === 'your-resend-api-key-here') {
      console.warn('⚠️ Resend API key not configured - emails will be simulated');
      this.resend = null;
    } else {
      console.log('✅ Resend API initialized');
      this.resend = new Resend(key);
    }
  }

  async sendWebsiteReadyEmail(options: EmailOptions): Promise<EmailResult> {
    const { to, businessName, previewUrl, previewImage, businessId } = options;

    console.log(`📧 Preparing to send email to: ${to}`);
    console.log(`   Business: ${businessName}`);
    console.log(`   Preview URL: ${previewUrl}`);

    // Create tracking URLs
    const trackingParams = new URLSearchParams({
      business_id: businessId,
      email: to,
      campaign: 'website_ready',
      timestamp: Date.now().toString()
    });

    const trackedPreviewUrl = `${previewUrl}?${trackingParams.toString()}&action=click`;
    const trackingPixelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/track-email?${trackingParams.toString()}&action=open`;
    
    try {
      // Generate email HTML
      const emailHtml = WebsiteReadyEmailTemplate({
        businessName,
        previewUrl: trackedPreviewUrl,
        previewImage: previewImage || '',
        trackingPixelUrl
      });

      // If Resend is not configured, simulate sending
      if (!this.resend) {
        console.log('📧 SIMULATED: Email would be sent to:', to);
        console.log('   Subject:', `${businessName} - Your Website is Ready!`);
        console.log('   Preview URL:', trackedPreviewUrl);
        console.log('✅ Email sent successfully (simulated)');
        
        return {
          success: true,
          messageId: `simulated-${Date.now()}`
        };
      }

      // Actually send the email with Resend
      const result = await this.sendWithRetry({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: [to],
        subject: `${businessName} - Your Website is Ready!`,
        html: emailHtml,
        tags: [
          { name: 'campaign', value: 'website_ready' },
          { name: 'business_id', value: businessId }
        ]
      });

      console.log(`✅ Email sent successfully to ${to}! Message ID: ${result.id}`);

      return {
        success: true,
        messageId: result.id
      };
    } catch (error) {
      console.error(`❌ Error sending email to ${to}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendBatch(emails: EmailOptions[]): Promise<BatchEmailResult> {
    const results: BatchEmailResult = {
      sent: 0,
      failed: 0,
      results: []
    };

    console.log(`📧 Starting batch send for ${emails.length} emails`);

    for (const emailOptions of emails) {
      // Rate limiting
      await this.delay(this.rateLimitDelay);

      const result = await this.sendWebsiteReadyEmail(emailOptions);
      
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
      }

      results.results.push({
        email: emailOptions.to,
        success: result.success,
        messageId: result.messageId,
        error: result.error
      });

      console.log(`   Progress: ${results.sent + results.failed}/${emails.length} (${results.sent} sent, ${results.failed} failed)`);
    }

    console.log(`✅ Batch send complete: ${results.sent} sent, ${results.failed} failed`);

    return results;
  }

  private async sendWithRetry(data: any, attempt = 1): Promise<any> {
    if (!this.resend) {
      // Simulate for testing
      return { id: `simulated-${Date.now()}` };
    }

    try {
      const result = await this.resend.emails.send(data);
      
      if ('error' in result && result.error) {
        // Handle different error formats - sometimes error is an object, sometimes a string
        const errorMessage = typeof result.error === 'string' 
          ? result.error 
          : result.error.message || result.error.name || JSON.stringify(result.error);
        throw new Error(errorMessage || 'Unknown Resend error');
      }
      
      return result.data;
    } catch (error) {
      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⚠️ Retry attempt ${attempt} after ${delay}ms`);
        await this.delay(delay);
        return this.sendWithRetry(data, attempt + 1);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async trackEmailOpen(businessId: string, email: string, campaign: string): Promise<void> {
    try {
      // Log email open event
      console.log('📊 Email opened:', { businessId, email, campaign, timestamp: new Date() });
      
      // In production, you'd save this to your database
      // await supabase.from('email_tracking').insert({
      //   business_id: businessId,
      //   email,
      //   campaign,
      //   action: 'open',
      //   timestamp: new Date()
      // });
    } catch (error) {
      console.error('Error tracking email open:', error);
    }
  }

  async trackEmailClick(businessId: string, email: string, campaign: string, link: string): Promise<void> {
    try {
      // Log email click event
      console.log('📊 Email clicked:', { businessId, email, campaign, link, timestamp: new Date() });
      
      // In production, you'd save this to your database
      // await supabase.from('email_tracking').insert({
      //   business_id: businessId,
      //   email,
      //   campaign,
      //   action: 'click',
      //   link,
      //   timestamp: new Date()
      // });
    } catch (error) {
      console.error('Error tracking email click:', error);
    }
  }

  // Additional email templates for different stages
  async sendFollowUpEmail(options: EmailOptions & { daysSinceSent: number }): Promise<EmailResult> {
    console.log(`📧 Sending follow-up email to: ${options.to} (${options.daysSinceSent} days since initial)`);
    
    // You can create different follow-up templates based on days
    const subject = options.daysSinceSent === 3 
      ? `${options.businessName} - Have you checked out your new website?`
      : `${options.businessName} - Your website is waiting for you!`;
    
    // For now, reuse the main template
    return this.sendWebsiteReadyEmail(options);
  }

  async sendReminderEmail(options: EmailOptions): Promise<EmailResult> {
    console.log(`📧 Sending reminder email to: ${options.to}`);
    
    // For now, reuse the main template with a different subject
    return this.sendWebsiteReadyEmail(options);
  }
}

export function createEmailService(apiKey?: string): EmailService {
  return new EmailService(apiKey);
}
