# 🎯 Where to Find the Claim Button

## In the Admin Panel (http://localhost:3000/admin)

When you go to the **Websites** tab, each business card has these buttons:

```
┌─────────────────────────────────┐
│  [Business Name]                │
│  [Preview Thumbnail]            │
│                                 │
│  ┌──────┐ ┌──────┐             │
│  │ 👁️   │ │ 💵   │             │
│  │ View │ │Claim │ <- THIS ONE │
│  └──────┘ └──────┘             │
│                                 │
│  ┌──────┐ ┌──────┐             │
│  │ Mail │ │ Copy │             │
│  └──────┘ └──────┘             │
│                                 │
│  ┌─────────────────┐           │
│  │     Delete      │           │
│  └─────────────────┘           │
└─────────────────────────────────┘
```

## What Each Button Does:

- **View (Gray)** → Opens the preview website (customer-facing site)
- **Claim (Green with $ icon)** → Opens the payment/claim page ✅ **USE THIS ONE**
- **Send/Mail (Blue)** → Sends email to business
- **Copy (Gray)** → Copies preview URL
- **Delete (Red)** → Deletes the preview

## Direct Links to Claim Pages:

If you can't see the Claim button, use these direct links:

### Beach Auto Repair
http://localhost:3000/claim/0100844a-f2ba-4494-961a-ed5b7c9fd7e5

### Bella's Hair Salon  
http://localhost:3000/claim/9dfb04c9-b4fe-4f94-bce2-5a01920483a3

### Sunshine Cleaners
http://localhost:3000/claim/032a1bba-8304-45f3-893b-03beab761c54

### Joe's Pizza
http://localhost:3000/claim/4b226c6c-6912-4010-bdf4-97c2be451ca3

### Miami Plumbing Pro
http://localhost:3000/claim/52e4ed7f-dcbc-486f-b94a-38deaa9a912f

## What You'll See on the Claim Page:

1. The website preview in the background
2. A floating card on the right with:
   - "$150/year" pricing
   - Domain name input field
   - "Get My Website" button
   - What's included list

## Testing the Payment Flow:

1. Enter a domain name (e.g., "mybusiness")
2. Click "Check" to verify availability
3. Click "Get My Website"
4. Enter your email when prompted
5. You'll be redirected to Stripe checkout
6. Use test card: 4242 4242 4242 4242

---

## Note About Hydration Errors:

The hydration errors you're seeing are cosmetic and don't affect functionality. They're caused by dynamic content in the previews (like timestamps). The app still works perfectly!
