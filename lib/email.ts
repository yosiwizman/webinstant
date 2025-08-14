import { Resend } from 'resend';
import { WebsiteReadyEmail } from '@/components/emails/WebsiteReadyEmail';
import { createElement } from 'react';

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

export class EmailService {
  private resend: Resend;
  private rateLimitDelay = 100; // 100ms between emails = 10 per second
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second initial retry delay

  constructor(apiKey?: string) {
    const key = apiKey || process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error('Resend API key is required');
    }
    this.resend = new Resend(key);
  }

  async sendWebsiteReadyEmail(options: EmailOptions): Promise<EmailResult> {
    const { to, businessName, previewUrl, previewImage, businessId } = options;

    // Create tracking URLs
    const trackingParams = new URLSearchParams({
      business_id: businessId,
      email: to,
      campaign: 'website_ready',
      timestamp: Date.now().toString()
    });

    const trackedPreviewUrl = `${previewUrl}?${trackingParams.toString()}&action=click`;
    
    try {
      const emailHtml = this.renderEmailToString(
        createElement(WebsiteReadyEmail, {
          businessName,
          previewUrl: trackedPreviewUrl,
          previewImage: previewImage || '',
          trackingPixelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/track-email?${trackingParams.toString()}&action=open`
        })
      );

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

      return {
        success: true,
        messageId: result.id
      };
    } catch (error) {
      console.error('Error sending email:', error);
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
    }

    return results;
  }

  private async sendWithRetry(data: any, attempt = 1): Promise<any> {
    try {
      const result = await this.resend.emails.send(data);
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      return result.data;
    } catch (error) {
      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Retry attempt ${attempt} after ${delay}ms`);
        await this.delay(delay);
        return this.sendWithRetry(data, attempt + 1);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private renderEmailToString(element: React.ReactElement): string {
    // This is a simplified version - in production you'd use react-dom/server
    // For now, we'll return the HTML directly from the component
    // In a real implementation, you'd use ReactDOMServer.renderToStaticMarkup
    return `<!DOCTYPE html>${element}`;
  }

  async trackEmailOpen(businessId: string, email: string, campaign: string): Promise<void> {
    try {
      // Log email open event
      console.log('Email opened:', { businessId, email, campaign, timestamp: new Date() });
      
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
      console.log('Email clicked:', { businessId, email, campaign, link, timestamp: new Date() });
      
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
}

export function createEmailService(apiKey?: string): EmailService {
  return new EmailService(apiKey);
}
