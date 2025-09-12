# 🚀 WebInstant - Instant $150 Websites for Small Businesses

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Stripe](https://img.shields.io/badge/Stripe-Integrated-green)](https://stripe.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-orange)](https://supabase.com/)

## 📌 Overview

WebInstant automatically creates professional websites for the 12 million US businesses without an online presence. The system generates custom websites, emails them to business owners, and allows instant purchase for just $150.

**Live Demo**: Coming Soon  
**Repository**: [github.com/yosiwizman/webinstant](https://github.com/yosiwizman/webinstant)

## 🎯 Business Model

1. **Find** - Identify businesses without websites (via Google Places API)
2. **Generate** - Create professional websites using AI (GPT-4, Claude, Together AI)
3. **Email** - Send preview to business owner
4. **Claim** - Business owner pays $150 to go live
5. **Deploy** - Website live in 24 hours with custom domain

## ✨ Features

### For Business Owners
- ✅ Professional website ready instantly
- ✅ No technical skills required
- ✅ Custom domain included
- ✅ Mobile responsive design
- ✅ SEO optimized
- ✅ SSL certificate included
- ✅ 1 year hosting included
- ✅ Only $150 total cost

### For Administrators
- 📊 Bulk website generation
- 📧 Automated email campaigns
- 💳 Stripe payment integration
- 📈 Revenue dashboard
- 🎨 5+ business category templates
- 🤖 AI-powered content generation
- 🖼️ AI image generation
- 📱 Mobile-first designs

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (Supabase)
- **Payments**: Stripe
- **AI Services**: 
  - OpenAI GPT-4
  - Anthropic Claude
  - Together AI
  - Replicate (images)
- **Email**: Resend
- **Deployment**: Vercel
- **Domain Management**: Porkbun/Namecheap API

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account
- AI API keys (OpenAI, Anthropic, Together AI, Replicate)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yosiwizman/webinstant.git
cd webinstant
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key

# AI Services
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
TOGETHER_API_KEY=your_together_key
REPLICATE_API_TOKEN=your_replicate_token

# Email
RESEND_API_KEY=your_resend_key

# Other services
SERPAPI_KEY=your_serpapi_key
TINYPNG_API_KEY=your_tinypng_key
```

4. **Set up database**

Run the SQL scripts in Supabase SQL Editor:
```sql
-- Run these in order:
1. CREATE_PAYMENT_TABLES.sql
2. FIX_DATABASE_TABLES.sql
```

5. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
webinstant/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── create-checkout-session/  # Stripe payment
│   │   ├── generate-preview/         # Website generation
│   │   ├── send-email/              # Email sending
│   │   └── verify-payment/          # Payment verification
│   ├── admin/             # Admin dashboard
│   ├── claim/             # Payment/claim pages
│   ├── preview/           # Website previews
│   └── payment/           # Payment success/cancel
├── components/            # React components
│   └── admin/            # Admin components
├── lib/                   # Core business logic
│   ├── contentGenerator.ts    # AI content generation
│   ├── supabase.ts           # Database client
│   └── email.ts              # Email templates
├── public/                # Static assets
└── scripts/              # Utility scripts
```

## 💰 Payment Flow

1. Business owner clicks "Claim Your Website" on preview
2. Enters domain name choice
3. Redirected to Stripe checkout
4. Payment processed ($150)
5. Success page confirmation
6. Website deployed within 24 hours

## 🧪 Testing

### Test Payment Flow
```bash
node test-payment-flow.js
```

Use Stripe test card: `4242 4242 4242 4242`

### Test Database Connection
```bash
node test-db.js
```

### Test Email Sending
```bash
node test-email-real-business.js
```

## 📊 Admin Dashboard

Access at: http://localhost:3000/admin

Features:
- View all generated websites
- Send email campaigns
- Track revenue
- Monitor API usage
- Bulk generate websites

## 🔑 Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-preview` | POST | Generate website preview |
| `/api/create-checkout-session` | POST | Create Stripe checkout |
| `/api/verify-payment` | POST | Verify payment status |
| `/api/send-email` | POST | Send email to business |
| `/api/admin/batch-generate` | POST | Bulk generate websites |

## 📝 Database Schema

<!-- CI Nudge: minor doc tweak to trigger Actions -->

### Main Tables
- `businesses` - Business information
- `website_previews` - Generated websites
- `payment_intents` - Payment tracking
- `email_logs` - Email history
- `deployed_websites` - Live websites
- `domain_registrations` - Domain tracking

## 🚢 Deployment

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yosiwizman/webinstant)

1. Click the button above
2. Add environment variables
3. Deploy

## 📈 Business Metrics

- **Cost per website**: ~$12 (domain)
- **Revenue per website**: $150
- **Profit per website**: ~$138
- **Time to deploy**: 24 hours
- **Conversion target**: 1-2%

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this for your own business!

## 🆘 Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/yosiwizman/webinstant/issues)
- Email: support@webinstant.com (coming soon)

## 🎯 Roadmap

- [ ] Multi-page website option
- [ ] Website editor interface
- [ ] Subscription model
- [ ] White-label partner program
- [ ] International expansion
- [ ] Mobile app

## 👨‍💻 Author

**Yosi Wizman**  
GitHub: [@yosiwizman](https://github.com/yosiwizman)

---

Built with ❤️ to help small businesses get online instantly
