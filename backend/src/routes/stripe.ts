import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { supabase } from '../services/supabase';
import Stripe from 'stripe';

export const stripeRouter = Router();
stripeRouter.use(requireAuth);

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2024-04-10' as any });
}

const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || '';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();

// POST /api/stripe/create-checkout-session
stripeRouter.post('/create-checkout-session', async (req: AuthRequest, res: Response) => {
  try {
    const stripe = getStripe();
    if (!PRO_PRICE_ID) return res.status(500).json({ error: 'Stripe price not configured' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      success_url: `${FRONTEND_URL}/settings?upgraded=1`,
      cancel_url: `${FRONTEND_URL}/settings?cancelled=1`,
      client_reference_id: req.user!.id,
      customer_email: req.user!.email,
      metadata: { user_id: req.user!.id },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/create-portal-session
stripeRouter.post('/create-portal-session', async (req: AuthRequest, res: Response) => {
  try {
    const stripe = getStripe();

    // Get customer ID from our DB
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', req.user!.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found. Please subscribe first.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${FRONTEND_URL}/settings`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/webhook — Stripe sends events here
// Must be registered WITHOUT requireAuth and WITH raw body
export async function stripeWebhookHandler(req: any, res: any) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe] webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id || session.client_reference_id;
      if (userId && session.customer) {
        // Upgrade user to pro and store customer ID
        await supabase.from('profiles').update({
          plan: 'pro',
          stripe_customer_id: session.customer as string,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);
        console.log(`[Stripe] upgraded user ${userId} to pro`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      // Downgrade user back to free
      await supabase.from('profiles').update({
        plan: 'free',
        updated_at: new Date().toISOString(),
      }).eq('stripe_customer_id', customerId);
      console.log(`[Stripe] downgraded customer ${customerId} to free`);
    }

    if (event.type === 'invoice.payment_failed') {
      // Optional: notify user their payment failed
      console.warn('[Stripe] payment failed for:', (event.data.object as any).customer);
    }
  } catch (err: any) {
    console.error('[Stripe] webhook processing error:', err.message);
  }

  res.json({ received: true });
}
