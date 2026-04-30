import { NextRequest, NextResponse } from 'next/server'

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
const RETRY_DELAYS_MS = [0, 2_000, 4_000, 8_000]

export async function POST(request: NextRequest) {
  try {
    const { question, companyName, companyNumber, analysisContext, companyContext, chatHistory } = await request.json()

    console.log('[ask-ai] companyContext received:', {
      received: companyContext != null,
      keyCount: companyContext && typeof companyContext === 'object' ? Object.keys(companyContext).length : 0,
    })

    if (!question || !companyName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const messages = [
      ...(chatHistory || []),
      { role: 'user', content: question }
    ]

    const systemPrompt = companyContext
      ? `You are an expert company intelligence analyst. You have access to comprehensive Companies House data for ${companyName} (company number: ${companyNumber}). Answer the user's questions accurately based on the data provided. If something isn't in the data, say so clearly rather than guessing.

## COMPANY PROFILE
${JSON.stringify(companyContext.companyProfile, null, 2)}

## CURRENT DIRECTORS & OFFICERS
${JSON.stringify(companyContext.officers, null, 2)}

## DIRECTOR APPOINTMENT HISTORIES (other companies each active director is or has been involved with)
${JSON.stringify(companyContext.directorAppointments, null, 2)}

## PERSONS WITH SIGNIFICANT CONTROL (beneficial owners)
${JSON.stringify(companyContext.personsWithSignificantControl, null, 2)}

## CHARGES & MORTGAGES
${JSON.stringify(companyContext.charges, null, 2)}

## RECENT FILING HISTORY
${JSON.stringify(companyContext.filingHistory, null, 2)}

## AI ACCOUNTS ANALYSIS
${analysisContext}`
      : `You are a company intelligence analyst for DocuData, a UK company intelligence platform. You have been given the AI analysis of ${companyName} (Companies House number: ${companyNumber}) extracted from their filed accounts at Companies House.

Here is the full analysis:
${analysisContext}

Answer the user's questions about this company concisely and accurately based on the analysis provided. Be direct and professional. Keep responses to 2-3 short paragraphs maximum. If asked something not covered by the analysis, say so clearly.`

    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    })

    let anthropicRes!: Response

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      if (RETRY_DELAYS_MS[attempt] > 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
      }

      anthropicRes = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
        },
        body,
      })

      if (anthropicRes.status !== 529) break

      console.warn(`[ask-ai] Anthropic overloaded (529), attempt ${attempt + 1}/${RETRY_DELAYS_MS.length}`)
    }

    if (anthropicRes.status === 529) {
      return NextResponse.json(
        { error: 'AI temporarily unavailable — Anthropic API is overloaded. Please try again in a few minutes.' },
        { status: 503 }
      )
    }

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text().catch(() => '')
      console.error('[ask-ai] Anthropic error:', errBody)
      return NextResponse.json({ error: `Anthropic API error (${anthropicRes.status})` }, { status: 502 })
    }

    const aiData = await anthropicRes.json()
    const answer = aiData.content?.[0]?.text ?? ''

    return NextResponse.json({
      answer,
      assistantMessage: { role: 'assistant', content: answer }
    })
  } catch (error) {
    console.error('Ask AI error:', error)
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 })
  }
}
