'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  priceId: string
  userId: string
  email: string
  featured?: boolean
}

export default function PricingCheckoutButton({ priceId, featured }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email ?? ''
      const userId = session?.user?.id ?? ''

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId, email }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        width: '100%',
        padding: '11px 0',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: loading ? 'not-allowed' : 'pointer',
        border: featured ? 'none' : '1.5px solid #e2e8f0',
        backgroundColor: featured ? '#4f46e5' : '#ffffff',
        color: featured ? '#ffffff' : '#0f172a',
        opacity: loading ? 0.7 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {loading ? 'Redirecting…' : 'Get started'}
    </button>
  )
}
