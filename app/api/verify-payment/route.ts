import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  console.log('🔍 Verifying payment...');
  
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      console.log('⚠️ Payment not completed:', session.payment_status);
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    console.log('✅ Payment verified for business:', session.metadata?.businessId);

    // Update payment status in database
    const { error: updateError } = await supabase
      .from('payment_intents')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('stripe_session_id', sessionId);

    if (updateError) {
      console.error('⚠️ Failed to update payment status:', updateError);
    }

    // Update business record to mark as paid
    if (session.metadata?.businessId) {
      const { error: businessError } = await supabase
        .from('businesses')
        .update({ 
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          domain_name: session.metadata.domainName,
        })
        .eq('id', session.metadata.businessId);

      if (businessError) {
        console.error('⚠️ Failed to update business:', businessError);
      }

      // Send confirmation email
      await sendConfirmationEmail(session);
    }

    return NextResponse.json({ 
      success: true,
      businessId: session.metadata?.businessId,
      domainName: session.metadata?.domainName
    });

  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}

async function sendConfirmationEmail(session: Stripe.Checkout.Session) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: session.metadata?.businessId,
        template: 'payment_confirmation',
        data: {
          businessName: session.metadata?.businessName,
          domainName: session.metadata?.domainName,
          amount: session.amount_total ? session.amount_total / 100 : 150,
          customerEmail: session.customer_email,
        }
      }),
    });

    if (!response.ok) {
      console.error('⚠️ Failed to send confirmation email');
    } else {
      console.log('✅ Confirmation email sent');
    }
  } catch (error) {
    console.error('⚠️ Error sending confirmation email:', error);
  }
}
