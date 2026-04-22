import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const { priceId, userId, email } = await request.json()

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
  }

  if (email && email.includes('@')) {
    sessionParams.customer_email = email
  }

  const session = await getStripe().checkout.sessions.create(sessionParams)

  return NextResponse.json({ url: session.url })
}
