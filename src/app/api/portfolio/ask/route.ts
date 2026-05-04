import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AccountsAnalysis } from "@/lib/analysis-types";

export const maxDuration = 60;

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: { portfolio_id?: string; question?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const portfolioId = body.portfolio_id;
  const question = body.question?.trim();

  if (!portfolioId || !question) {
    return new Response(JSON.stringify({ error: "Missing portfolio_id or question" }), { status: 400 });
  }

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, user_id")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) {
    return new Response(JSON.stringify({ error: "Portfolio not found" }), { status: 404 });
  }

  const { data: companies } = await supabase
    .from("portfolio_companies")
    .select("company_number, company_name")
    .eq("portfolio_id", portfolioId)
    .eq("analysis_status", "complete");

  const list = companies ?? [];
  if (list.length === 0) {
    return new Response(JSON.stringify({ error: "No analysed companies in this portfolio yet" }), { status: 400 });
  }

  const companyNumbers = list.map((c) => c.company_number);
  const { data: cacheRows } = await supabase
    .from("analysis_cache")
    .select("company_number, analysis")
    .in("company_number", companyNumbers);

  const cacheMap = new Map<string, AccountsAnalysis>();
  for (const row of cacheRows ?? []) {
    cacheMap.set(row.company_number, row.analysis as AccountsAnalysis);
  }

  const summaries = list
    .map((company) => {
      const analysis = cacheMap.get(company.company_number);
      if (!analysis) return null;
      const exec = analysis.executiveSummary ?? "(no executive summary)";
      const risksRaw = analysis.keyRisks?.risks ?? [];
      const risks = Array.isArray(risksRaw) && risksRaw.length > 0
        ? risksRaw.map((r) => `  - ${r}`).join("\n")
        : "  (none recorded)";
      return `### ${company.company_name} (${company.company_number})
Executive summary: ${exec}
Key risks:
${risks}`;
    })
    .filter((s): s is string => s !== null)
    .join("\n\n");

  const systemPrompt = `You are a senior accountant's assistant. You have access to AI-generated financial analysis for ${list.length} companies. Answer the user's question by scanning all companies and identifying relevant ones. Always cite the company name and number when referencing a specific company. Be specific — do not give generic answers.

PORTFOLIO ANALYSIS DATA:

${summaries}`;

  const anthropicBody = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    stream: true,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  });

  const upstream = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: anthropicBody,
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error("[portfolio/ask] Anthropic error:", errText);
    return new Response(JSON.stringify({ error: `AI request failed (${upstream.status})` }), { status: 502 });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const event = JSON.parse(payload);
              if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                const text: string = event.delta.text ?? "";
                if (text) controller.enqueue(encoder.encode(text));
              }
            } catch {
              // skip malformed event line
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
