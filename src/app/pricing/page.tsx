import { createClient } from '@/lib/supabase/server'
import PricingCheckoutButton from '@/components/PricingCheckoutButton'

const TIERS = [
  {
    name: 'Starter',
    price: '£49',
    period: '/month',
    description: 'For individuals and small teams getting started.',
    priceIdEnv: 'STRIPE_STARTER_PRICE_ID',
    features: [
      '50 searches per month',
      'Full AI financial analysis',
      'Director network mapping',
      'Watchlist (10 companies)',
    ],
    featured: false,
  },
  {
    name: 'Professional',
    price: '£149',
    period: '/month',
    description: 'For growing teams that need more power.',
    priceIdEnv: 'STRIPE_PROFESSIONAL_PRICE_ID',
    features: [
      'Unlimited searches',
      '3 team seats',
      'Watchlist (50 companies)',
      'PDF export',
      'Company comparison tool',
    ],
    featured: true,
  },
  {
    name: 'Business',
    price: '£349',
    period: '/month',
    description: 'For enterprises that need everything.',
    priceIdEnv: 'STRIPE_BUSINESS_PRICE_ID',
    features: [
      'Everything in Professional',
      '10 team seats',
      'Unlimited watchlist',
      'Bulk search',
      'API access',
    ],
    featured: false,
  },
]

export default async function PricingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const priceIds = {
    STRIPE_STARTER_PRICE_ID: process.env.STRIPE_STARTER_PRICE_ID ?? '',
    STRIPE_PROFESSIONAL_PRICE_ID: process.env.STRIPE_PROFESSIONAL_PRICE_ID ?? '',
    STRIPE_BUSINESS_PRICE_ID: process.env.STRIPE_BUSINESS_PRICE_ID ?? '',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
        padding: '60px 24px',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <a
          href="/dashboard"
          style={{
            display: 'inline-block',
            marginBottom: '32px',
            fontFamily: 'var(--font-instrument-serif), "Instrument Serif", serif',
            fontSize: '22px',
            textDecoration: 'none',
            lineHeight: '1',
          }}
        >
          <span style={{ color: '#0f172a' }}>Docu</span>
          <span style={{ color: '#4f46e5' }}>Data</span>
        </a>
        <h1
          style={{
            fontFamily: 'var(--font-instrument-serif), "Instrument Serif", serif',
            fontSize: '40px',
            fontWeight: '400',
            color: '#0f172a',
            marginBottom: '14px',
            lineHeight: '1.15',
          }}
        >
          Simple, transparent pricing
        </h1>
        <p style={{ fontSize: '16px', color: '#475569', maxWidth: '480px', margin: '0 auto' }}>
          Choose the plan that fits your due diligence workflow. Cancel anytime.
        </p>
      </div>

      {/* Tier cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
          maxWidth: '960px',
          margin: '0 auto',
          alignItems: 'start',
        }}
      >
        {TIERS.map((tier) => {
          const priceId = priceIds[tier.priceIdEnv as keyof typeof priceIds]
          return (
            <div
              key={tier.name}
              style={{
                backgroundColor: '#ffffff',
                border: tier.featured ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '28px 24px',
                boxShadow: tier.featured
                  ? '0 4px 24px rgba(79,70,229,0.15)'
                  : '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)',
                position: 'relative',
              }}
            >
              {tier.featured && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '4px 12px',
                    borderRadius: '100px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Most popular
                </div>
              )}

              {/* Tier name */}
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: tier.featured ? '#4f46e5' : '#475569',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: '12px',
                }}
              >
                {tier.name}
              </div>

              {/* Price */}
              <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span
                  style={{
                    fontSize: '38px',
                    fontWeight: '800',
                    color: '#0f172a',
                    lineHeight: '1',
                  }}
                >
                  {tier.price}
                </span>
                <span style={{ fontSize: '14px', color: '#94a3b8' }}>{tier.period}</span>
              </div>

              <p
                style={{
                  fontSize: '13px',
                  color: '#475569',
                  marginBottom: '24px',
                  lineHeight: '1.5',
                }}
              >
                {tier.description}
              </p>

              {/* CTA */}
              <PricingCheckoutButton
                priceId={priceId}
                userId={user?.id ?? ''}
                email={user?.email ?? ''}
                featured={tier.featured}
              />

              {/* Feature list */}
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '24px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontSize: '13px',
                      color: '#0f172a',
                    }}
                  >
                    <span style={{ color: '#4f46e5', flexShrink: 0, marginTop: '1px' }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <p
        style={{
          textAlign: 'center',
          marginTop: '40px',
          fontSize: '13px',
          color: '#94a3b8',
        }}
      >
        All prices exclude VAT. Billed monthly. Cancel anytime from your account settings.
      </p>
    </div>
  )
}
