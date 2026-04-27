import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { question, companyName, companyNumber, analysisContext, chatHistory } = await request.json()

    if (!question || !companyName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const messages = [
      ...(chatHistory || []),
      { role: 'user' as const, content: question }
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a company intelligence analyst for DocuData, a UK company intelligence platform. You have been given the AI analysis of ${companyName} (Companies House number: ${companyNumber}) extracted from their filed accounts at Companies House.

Here is the full analysis:
${analysisContext}

Answer the user's questions about this company concisely and accurately based on the analysis provided. Be direct and professional. Keep responses to 2-3 short paragraphs maximum. If asked something not covered by the analysis, say so clearly.`,
      messages
    })

    const answer = response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({
      answer,
      assistantMessage: { role: 'assistant', content: answer }
    })
  } catch (error) {
    console.error('Ask AI error:', error)
    return NextResponse.json({ error: 'Failed to get AI response' }, { status: 500 })
  }
}
