import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AccountsAnalysis } from "@/lib/analysis-types";
import { analyseCompany } from "@/lib/analyse-company";

export const maxDuration = 300;

const CACHE_FRESH_DAYS = 7;
const CONCURRENCY = 5;

type ProgressEvent =
  | { type: "start"; total: number }
  | {
      type: "progress";
      index: number;
      total: number;
      companyNumber: string;
      status: "complete" | "error" | "cached";
      error?: string;
      analysis?: AccountsAnalysis | null;
      lastAnalysedAt?: string;
    }
  | { type: "done"; total: number; completed: number; errors: number };

export async function POST(request: NextRequest) {
  console.log("[api/portfolio/analyse] POST received");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[api/portfolio/analyse] unauthorised");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: { portfolio_id?: string; company_numbers?: string[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const portfolioId = body.portfolio_id;
  const companyNumbers = (body.company_numbers ?? []).map((n) => n.toUpperCase()).filter(Boolean);
  console.log("[api/portfolio/analyse] payload", { portfolioId, count: companyNumbers.length });

  if (!portfolioId || companyNumbers.length === 0) {
    return new Response(JSON.stringify({ error: "Missing portfolio_id or company_numbers" }), { status: 400 });
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      send({ type: "start", total: companyNumbers.length });

      let completed = 0;
      let errors = 0;
      let cursor = 0;

      async function processOne(companyNumber: string, index: number) {
        try {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - CACHE_FRESH_DAYS);

          const { data: cached } = await supabase
            .from("analysis_cache")
            .select("company_number, cached_at, analysis")
            .eq("company_number", companyNumber)
            .gt("cached_at", cutoff.toISOString())
            .maybeSingle();

          if (cached) {
            const lastAnalysedAt = new Date().toISOString();
            await supabase
              .from("portfolio_companies")
              .update({
                analysis_status: "complete",
                last_analysed_at: lastAnalysedAt,
              })
              .eq("portfolio_id", portfolioId)
              .eq("company_number", companyNumber);

            completed += 1;
            send({
              type: "progress",
              index,
              total: companyNumbers.length,
              companyNumber,
              status: "cached",
              analysis: (cached.analysis as AccountsAnalysis | undefined) ?? null,
              lastAnalysedAt,
            });
            return;
          }

          await supabase
            .from("portfolio_companies")
            .update({ analysis_status: "analysing" })
            .eq("portfolio_id", portfolioId)
            .eq("company_number", companyNumber);

          const analysis = await analyseCompany(companyNumber);

          const lastAnalysedAt = new Date().toISOString();
          await supabase
            .from("portfolio_companies")
            .update({
              analysis_status: "complete",
              last_analysed_at: lastAnalysedAt,
            })
            .eq("portfolio_id", portfolioId)
            .eq("company_number", companyNumber);

          completed += 1;
          send({
            type: "progress",
            index,
            total: companyNumbers.length,
            companyNumber,
            status: "complete",
            analysis,
            lastAnalysedAt,
          });
        } catch (err) {
          await supabase
            .from("portfolio_companies")
            .update({ analysis_status: "error" })
            .eq("portfolio_id", portfolioId)
            .eq("company_number", companyNumber);

          errors += 1;
          send({
            type: "progress",
            index,
            total: companyNumbers.length,
            companyNumber,
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      async function worker() {
        while (cursor < companyNumbers.length) {
          const myIndex = cursor++;
          await processOne(companyNumbers[myIndex], myIndex);
        }
      }

      const workers = Array.from(
        { length: Math.min(CONCURRENCY, companyNumbers.length) },
        () => worker()
      );
      await Promise.all(workers);

      send({ type: "done", total: companyNumbers.length, completed, errors });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
