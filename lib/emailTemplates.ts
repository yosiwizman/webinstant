export type TemplateKey = 'default' | 'variantA'

export interface EmailTemplate {
  subject: string
  content: string
}

export const templates: Record<TemplateKey, EmailTemplate> = {
  default: {
    subject: 'Your new website is ready, {{business_name}}',
    content: `
      <h1>Hey {{business_name}}, your website is live!</h1>
      <p>Preview it here: <a href="{{preview_url}}">{{preview_url}}</a></p>
      <p>Reply to this email and we can deploy it to your domain today.</p>
    `
  },
  variantA: {
    subject: 'Launch your website today — preview inside, {{business_name}}',
    content: `
      <h2>It's ready, {{business_name}}!</h2>
      <p>Instant preview: <a href="{{preview_url}}">{{preview_url}}</a></p>
      <p>We can map your custom domain in minutes. Let us know!</p>
    `
  }
}

