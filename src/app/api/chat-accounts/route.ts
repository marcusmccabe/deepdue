import { NextRequest, NextResponse } from "next/server";
import { getCachedAnalysis } from "@/lib/analysis-cache";

export const maxDuration = 60;

const CH_BASE = "https://api.company-information.service.gov.uk";
const CH_DOC_BASE = "https://document-api.company-information.service.gov.uk";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

// Delays before each attempt: attempt 1 immediate, then 2 s / 4 s / 8 s
const RETRY_DELAYS_MS = [0, 2_000, 4_000, 8_000];

function chAuth(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

export async function POST(request: NextRequest) {
  let body: {
    companyNumber?: string;
    companyName?: string;
    messages?: Array<{ role: string; content: string }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { companyNumber: rawNumber, companyName, messages } = body;

  if (!rawNumber || !companyName || !messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const companyNumber = rawNumber.toUpperCase();

  // ── 1. Check analysis cache ───────────────────────────────────────────────
  const cachedAnalysis = getCachedAnalysis(companyNumber);

  // ── 2. Attempt to fetch most recent accounts PDF ──────────────────────────
  let pdfBase64: string | null = null;

  try {
    const filingRes = await fetch(
      `${CH_BASE}/company/${companyNumber}/filing-history?items_per_page=50&category=accounts`,
      { headers: { Authorization: chAuth() }, cache: "no-store" }
    );

    if (filingRes.ok) {
      const filingData = await filingRes.json();
      const filingItems: Array<{
        category?: string;
        links?: { document_metadata?: string };
      }> = filingData.items ?? [];

      const filing = filingItems.find(
        (f) => f.category === "accounts" && f.links?.document_metadata
      );

      if (filing) {
        const metadataUrl = filing.links!.document_metadata!;
        const idMatch = metadataUrl.match(/\/document\/([^/?]+)/);

        if (idMatch) {
          const documentId = idMatch[1];

          const pdfRes = await fetch(
            `${CH_DOC_BASE}/document/${documentId}/content`,
            {
              headers: { Authorization: chAuth(), Accept: "application/pdf" },
              cache: "no-store",
            }
          );

          if (pdfRes.ok) {
            const buffer = await pdfRes.arrayBuffer();
            if (buffer.byteLength <= MAX_PDF_BYTES) {
              pdfBase64 = Buffer.from(buffer).toString("base64");
              console.log(
                `[chat-accounts] ${companyNumber}: downloaded ${Math.round(buffer.byteLength / 1024)} KB PDF`
              );
            }
          }
        }
      }
    }
  } catch {
    // PDF fetch failed — proceed with analysis context only
    console.warn(
      `[chat-accounts] ${companyNumber}: PDF fetch failed, proceeding with analysis only`
    );
  }

  // ── 3. Build system prompt ────────────────────────────────────────────────
  const systemPrompt = `You are a forensic accountant assistant helping a user understand the filed accounts of ${companyName}. Answer questions factually based only on the accounts document and the extracted analysis provided. If something is not disclosed in the accounts, say so clearly rather than speculating. Do not make credit recommendations or express opinions on whether the company is a good or bad risk — present facts only. Keep answers concise and precise.`;

  // ── 4. Build Claude messages array ───────────────────────────────────────
  type ContentBlock =
    | { type: "text"; text: string }
    | {
        type: "document";
        source: { type: "base64"; media_type: string; data: string };
      };

  type ClaudeMessage = {
    role: "user" | "assistant";
    content: string | ContentBlock[];
  };

  const claudeMessages: ClaudeMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Attach context blocks to the first user message only
    if (i === 0 && msg.role === "user") {
      const contentBlocks: ContentBlock[] = [];

      if (pdfBase64) {
        contentBlocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfBase64,
          },
        });
      }

      if (cachedAnalysis) {
        contentBlocks.push({
          type: "text",
          text: `Extracted analysis of ${companyName}:\n${JSON.stringify(cachedAnalysis, null, 2)}`,
        });
      }

      contentBlocks.push({ type: "text", text: msg.content });

      claudeMessages.push({ role: "user", content: contentBlocks });
    } else {
      claudeMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
  }

  // ── 5. Call Claude with retry on 529 overloaded ───────────────────────────
  const anthropicBody = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: systemPrompt,
    messages: claudeMessages,
  });

  let rawText: string;

  try {
    let anthropicRes!: Response;

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      if (RETRY_DELAYS_MS[attempt] > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt])
        );
      }

      anthropicRes = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: anthropicBody,
      });

      if (anthropicRes.status !== 529) break;

      console.warn(
        `[chat-accounts] ${companyNumber}: Anthropic overloaded (529),` +
          ` attempt ${attempt + 1}/${RETRY_DELAYS_MS.length}`
      );
    }

    if (anthropicRes.status === 529) {
      return NextResponse.json(
        {
          error:
            "Analysis temporarily unavailable — Anthropic API is overloaded. Please try again in a few minutes.",
        },
        { status: 503 }
      );
    }

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text().catch(() => "");
      console.error("[chat-accounts] Anthropic error:", errBody);
      return NextResponse.json(
        { error: `Anthropic API error (${anthropicRes.status})` },
        { status: 502 }
      );
    }

    const aiData = await anthropicRes.json();
    rawText = aiData.content?.[0]?.text ?? "";
  } catch {
    return NextResponse.json(
      { error: "Network error calling Anthropic API" },
      { status: 502 }
    );
  }

  // ── 6. Return reply ───────────────────────────────────────────────────────
  return NextResponse.json({ reply: rawText });
}
