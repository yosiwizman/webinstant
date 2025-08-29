import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(request: NextRequest) {
  console.log('💳 Creating Stripe checkout session...');
  
  try {
    const body = await request.json();
    const { 
      businessId, 
      domainName,
      email,
      businessName 
    } = body;

    if (!businessId || !domainName || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get business details from database
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      console.error('❌ Business not found:', businessError);
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'WebInstant Professional Website',
              description: `Complete website package for ${businessName || business.business_name}`,
              images: ['https://webinstant.com/logo.png'], // You can add a real logo later
              metadata: {
                businessId,
                domainName,
              },
            },
            unit_amount: 15000, // $150.00 in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&business_id=${businessId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/claim/${businessId}?canceled=true`,
      customer_email: email,
      metadata: {
        businessId,
        domainName,
        businessName: businessName || business.business_name,
      },
      // Add optional features
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
    });

    console.log('✅ Checkout session created:', session.id);

    // Store payment intent in database for tracking
    const { error: dbError } = await supabase
      .from('payment_intents')
      .insert({
        stripe_session_id: session.id,
        business_id: businessId,
        domain_name: domainName,
        amount: 150,
        status: 'pending',
        customer_email: email,
      });

    if (dbError) {
      console.error('⚠️ Failed to store payment intent:', dbError);
      // Continue anyway - payment is more important
    }

    return NextResponse.json({ 
      checkoutUrl: session.url,
      sessionId: session.id 
    });

  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Stripe Checkout Session Endpoint',
    method: 'POST',
    body: {
      businessId: 'string (required) - The business ID',
      domainName: 'string (required) - The selected domain name',
      email: 'string (required) - Customer email',
      businessName: 'string (optional) - Override business name',
    },
    response: {
      checkoutUrl: 'string - Stripe checkout URL to redirect to',
      sessionId: 'string - Stripe session ID for tracking',
    },
  });
}
