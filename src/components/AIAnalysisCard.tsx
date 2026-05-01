"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type {
  AccountsAnalysis,
  FinancialLineItem,
} from "@/lib/analysis-types";

// ── Shared card chrome ────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
  overflow: "hidden",
};

const SECTION_CARD: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  overflow: "hidden",
};

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        backgroundColor: bg,
        color,
        borderRadius: "100px",
        fontSize: "12px",
        fontWeight: "600",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function CardHeader({ badge }: { badge: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "15px 18px",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "22px",
            height: "22px",
            backgroundColor: "#4f46e5",
            borderRadius: "5px",
            flexShrink: 0,
          }}
        />
        <div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>
            AI Document Intelligence
          </div>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>
            Extracted from filed accounts
          </div>
        </div>
      </div>
      {badge}
    </div>
  );
}

// ── Section primitives ────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "13px",
        fontWeight: "700",
        color: "#0f172a",
        padding: "12px 16px",
        borderBottom: "1px solid #e2e8f0",
        backgroundColor: "#f8fafc",
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </div>
  );
}

const MUTED_MARKERS = ["None", "Not disclosed", "Not mentioned"];

function isMuted(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return MUTED_MARKERS.some(
    (m) => trimmed === m || trimmed.toLowerCase().startsWith(m.toLowerCase())
  );
}

function LabelledRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  const muted = typeof value === "string" && isMuted(value);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: "12px",
        padding: "10px 16px",
        borderBottom: "1px solid #f1f5f9",
        alignItems: "start",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: "600",
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          paddingTop: "1px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "13px",
          color: muted ? "#94a3b8" : "#0f172a",
          lineHeight: "1.55",
          fontStyle: muted ? "italic" : "normal",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionCard({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div style={SECTION_CARD}>
      <SectionHeading>{heading}</SectionHeading>
      <div>{children}</div>
    </div>
  );
}

// ── Financial line item (value + yoy) ────────────────────────────────────────

function FinancialLineItemValue({ item }: { item: FinancialLineItem }) {
  const muted = isMuted(item.value);
  const yoy = item.yoyChange ?? "n/a";
  const yoyMuted = !yoy || yoy === "n/a";
  let yoyColor = "#64748b";
  if (!yoyMuted) {
    if (yoy.startsWith("+")) yoyColor = "#059669";
    else if (yoy.startsWith("-")) yoyColor = "#dc2626";
  }
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: "14px",
          fontWeight: "700",
          color: muted ? "#94a3b8" : "#0f172a",
          fontStyle: muted ? "italic" : "normal",
        }}
      >
        {item.value}
      </span>
      <span
        style={{
          fontSize: "12px",
          fontWeight: "600",
          color: yoyMuted ? "#94a3b8" : yoyColor,
          fontStyle: yoyMuted ? "italic" : "normal",
        }}
      >
        {yoy}
      </span>
    </div>
  );
}

// ── Audit opinion badge ───────────────────────────────────────────────────────

function AuditOpinionBadge({ opinion }: { opinion: string }) {
  let color = "#94a3b8";
  let bg = "rgba(148,163,184,0.12)";
  if (opinion === "Clean") {
    color = "#059669";
    bg = "rgba(5,150,105,0.10)";
  } else if (opinion === "Qualified") {
    color = "#d97706";
    bg = "rgba(217,119,6,0.10)";
  } else if (opinion === "Adverse" || opinion === "Disclaimer of opinion") {
    color = "#dc2626";
    bg = "rgba(220,38,38,0.10)";
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "12px",
        fontWeight: "700",
        color,
        backgroundColor: bg,
        padding: "4px 11px",
        borderRadius: "100px",
        border: `1px solid ${color}44`,
      }}
    >
      {opinion}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  companyNumber: string;
  companyName?: string;
  directorAppointments?: Record<string, any[]>;
}

type Status = "loading" | "success" | "not-found" | "error";

export default function AIAnalysisCard({ companyNumber, companyName, directorAppointments }: Props) {
  const [question, setQuestion] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [chatHistory, setChatHistory] = useState<{role: string, content: string}[]>([])

  const suggestedQuestions = [
    'What is the financial health of this company?',
    'Who are the current directors and when were they appointed?',
    'What other companies are the directors involved in?',
    'Who are the beneficial owners of this company?',
    'Are there any outstanding charges or red flags?',
    'Summarise the most recent filings'
  ]

  const handleAsk = async (q?: string) => {
    const queryText = q || question
    if (!queryText.trim() || isAsking) return
    setIsAsking(true)
    setQuestion('')
    try {
      const res = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: queryText,
          companyName: companyName || '',
          companyNumber: companyNumber || '',
          analysisContext: JSON.stringify(analysis),
          companyContext: {
            directorAppointments: directorAppointments ?? {}
          },
          chatHistory
        })
      })
      const data = await res.json()
      if (data.answer) {
        setAnswer(data.answer)
        setChatHistory(prev => [
          ...prev,
          { role: 'user', content: queryText },
          { role: 'assistant', content: data.answer }
        ])
      }
    } catch (e) {
      setAnswer('Sorry, something went wrong. Please try again.')
    } finally {
      setIsAsking(false)
    }
  }

  const [status, setStatus] = useState<Status>("loading");
  const [analysis, setAnalysis] = useState<AccountsAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(
          `/api/analyse-accounts?companyNumber=${encodeURIComponent(companyNumber)}`
        );

        if (cancelled) return;

        if (res.status === 404) {
          setStatus("not-found");
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMsg((data as { error?: string }).error ?? `HTTP ${res.status}`);
          setStatus("error");
          return;
        }

        const data: AccountsAnalysis = await res.json();
        setAnalysis(data);
        setStatus("success");
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(String(err));
          setStatus("error");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [companyNumber]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div style={CARD}>
        <CardHeader badge={<Pill label="Analysing…" color="#4f46e5" bg="rgba(79,70,229,0.08)" />} />
        <div
          style={{
            padding: "40px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              border: "3px solid #e2e8f0",
              borderTop: "3px solid #4f46e5",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a", marginBottom: "6px" }}>
              Analysing filed accounts
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.6" }}>
              Claude is reading the most recent accounts document.
              <br />
              This may take up to 30 seconds.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (status === "not-found") {
    return (
      <div style={CARD}>
        <CardHeader badge={<Pill label="Not available" color="#94a3b8" bg="#f1f5f9" />} />
        <div
          style={{
            padding: "28px 18px",
            textAlign: "center",
            color: "#94a3b8",
            fontSize: "13px",
          }}
        >
          No accounts document found for this company in Companies House.
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div style={CARD}>
        <CardHeader badge={<Pill label="Error" color="#dc2626" bg="rgba(220,38,38,0.08)" />} />
        <div style={{ padding: "18px" }}>
          <div
            style={{
              borderLeft: "3px solid #dc2626",
              backgroundColor: "rgba(220,38,38,0.05)",
              borderRadius: "0 8px 8px 0",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginBottom: "4px" }}>
              Analysis failed
            </div>
            <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.55" }}>
              {errorMsg || "An unexpected error occurred. Please try refreshing."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (!analysis) return null;

  const fh = analysis.financialHealth;
  const mg = analysis.margins;
  const bs = analysis.balanceSheet;
  const cf = analysis.cashFlowSignals;
  const df = analysis.directorFlags;
  const sd = analysis.strategicDirection;
  const rw = analysis.risksAndWarnings;
  const ao = analysis.auditOpinion;
  const cs = analysis.complianceSignals;

  const statusBadge = analysis.cached ? (
    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span
        style={{
          padding: "3px 8px",
          backgroundColor: "rgba(100,116,139,0.10)",
          color: "#475569",
          borderRadius: "100px",
          fontSize: "11px",
          fontWeight: "600",
          border: "1px solid rgba(100,116,139,0.25)",
          whiteSpace: "nowrap",
        }}
      >
        Cached ·{" "}
        {new Date(analysis.analysedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </span>
    </span>
  ) : (
    <Pill label="✓ Analysis complete" color="#059669" bg="rgba(5,150,105,0.08)" />
  );

  const providerPill =
    analysis.provider === "gemini" ? (
      <Pill label="Analysed by Gemini" color="#475569" bg="rgba(100,116,139,0.10)" />
    ) : analysis.provider === "mistral" ? (
      <Pill label="Analysed by Mistral" color="#c2410c" bg="rgba(234,88,12,0.10)" />
    ) : analysis.provider === "google-docai" ? (
      <Pill label="OCR + AI Analysis" color="#1d4ed8" bg="rgba(29,78,216,0.10)" />
    ) : null;

  const headerBadge = providerPill ? (
    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      {statusBadge}
      {providerPill}
    </span>
  ) : (
    statusBadge
  );

  return (
    <div className="space-y-3">

      {/* Header + chips + risk cards */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#5B5BD6] rounded-md flex items-center justify-center text-white text-xs font-bold">✦</div>
            <div>
              <div className="text-sm font-semibold leading-tight">AI Document Intelligence</div>
              <div className="text-xs text-gray-400">Extracted from filed accounts</div>
            </div>
          </div>
          {analysis ? (
            <span className="text-xs font-semibold text-[#0F6E56] bg-[#E1F5EE] px-3 py-1 rounded-full">✓ Analysis complete</span>
          ) : (
            <span className="text-xs font-semibold text-white bg-[#5B5BD6] px-3 py-1 rounded-full cursor-pointer">Run AI Analysis</span>
          )}
        </div>

        {/* Risk chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {fh.revenue.yoyChange?.startsWith('-') && (
            <span className="text-xs font-semibold bg-[#FAEEDA] text-[#854F0B] px-3 py-1 rounded-full">
              Revenue declining {fh.revenue.yoyChange}
            </span>
          )}
          {fh.revenue.yoyChange?.startsWith('+') && (
            <span className="text-xs font-semibold bg-[#E1F5EE] text-[#0F6E56] px-3 py-1 rounded-full">
              Revenue growing {fh.revenue.yoyChange}
            </span>
          )}
          {(!isMuted(df.directorLoans) || !isMuted(df.relatedPartyTransactions)) ? (
            <span className="text-xs font-semibold bg-[#FCEBEB] text-[#A32D2D] px-3 py-1 rounded-full">Director flags present</span>
          ) : (
            <span className="text-xs font-semibold bg-[#E1F5EE] text-[#0F6E56] px-3 py-1 rounded-full">No director concerns</span>
          )}
        </div>

        {/* Three risk summary cards */}
        {(() => {
          const revenueYoy = fh.revenue.yoyChange ?? ''
          const creditRisk = revenueYoy.startsWith('-') ? 'Medium' : 'Low'
          const cashHealth = !isMuted(fh.cashPosition) ? 'Adequate' : 'Weak'
          const hasDirectorConcerns = !isMuted(df.directorLoans) || !isMuted(df.relatedPartyTransactions)
          const dirRisk = hasDirectorConcerns ? 'Medium' : 'Low'
          const s = {
            Low:      { bg: 'bg-[#E1F5EE] border-[#5DCAA5]', t: 'text-[#0F6E56]' },
            Medium:   { bg: 'bg-[#FAEEDA] border-[#EF9F27]', t: 'text-[#854F0B]' },
            High:     { bg: 'bg-[#FCEBEB] border-[#F09595]', t: 'text-[#A32D2D]' },
            Adequate: { bg: 'bg-[#FAEEDA] border-[#EF9F27]', t: 'text-[#854F0B]' },
            Weak:     { bg: 'bg-[#FCEBEB] border-[#F09595]', t: 'text-[#A32D2D]' },
          } as Record<string, {bg: string, t: string}>
          return (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Credit risk', val: creditRisk, sub: 'Revenue trend + equity' },
                { label: 'Cash health', val: cashHealth, sub: fh.cashPosition },
                { label: 'Director risk', val: dirRisk, sub: 'Based on filing flags' },
              ].map(({ label, val, sub }) => (
                <div key={label} className={`rounded-lg p-3 border ${s[val]?.bg}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${s[val]?.t}`}>{label}</div>
                  <div className={`text-sm font-bold ${s[val]?.t}`}>{val}</div>
                  <div className={`text-xs mt-1 ${s[val]?.t} opacity-80`}>{sub}</div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Ask AI panel */}
        <div className="bg-[#F5F5FF] border border-[#C7C7F0] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#5B5BD6] text-sm font-bold">✦</span>
            <span className="text-sm font-bold text-[#3D3D9E]">Ask AI about this company</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {suggestedQuestions.map(q => (
              <button
                key={q}
                onClick={() => handleAsk(q)}
                className="text-xs text-[#5B5BD6] bg-white border border-[#C7C7F0] rounded-full px-3 py-1 hover:bg-[#EEEEFF] transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
              placeholder={`Ask anything about ${companyName || 'this company'}...`}
              className="flex-1 border border-[#C7C7F0] rounded-lg px-3 py-2 text-sm bg-white text-gray-800 outline-none focus:border-[#5B5BD6]"
            />
            <button
              onClick={() => handleAsk()}
              disabled={isAsking || !question.trim()}
              className="bg-[#5B5BD6] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-[#4A4AC5] transition-colors"
            >
              {isAsking ? '...' : 'Ask'}
            </button>
          </div>
          {isAsking && (
            <div className="mt-3 flex gap-1">
              <div className="w-2 h-2 bg-[#5B5BD6] rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
              <div className="w-2 h-2 bg-[#5B5BD6] rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
              <div className="w-2 h-2 bg-[#5B5BD6] rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
            </div>
          )}
          {answer && !isAsking && (
            <div className="mt-3 bg-white border border-[#C7C7F0] rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {answer}
            </div>
          )}
        </div>
      </div>

      {/* Financial health + Margins grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Financial health</div>
          {[
            { label: 'Revenue', val: fh.revenue.value, change: fh.revenue.yoyChange },
            { label: 'Gross profit', val: fh.grossProfit.value, change: fh.grossProfit.yoyChange },
            { label: 'Operating profit', val: fh.operatingProfit.value, change: fh.operatingProfit.yoyChange },
            { label: 'Net profit', val: fh.netProfit.value, change: fh.netProfit.yoyChange },
            { label: 'Cash position', val: fh.cashPosition, change: null },
            { label: 'Net assets', val: fh.netAssets, change: null },
          ].filter(r => r.val && !isMuted(r.val)).map(({ label, val, change }) => (
            <div key={label} className="flex items-baseline py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-36 shrink-0">{label}</span>
              <span className="text-sm font-semibold mr-2">{val}</span>
              {change && !isMuted(change) && change !== 'n/a' && (
                <span className={`text-xs font-semibold ${change.startsWith('-') ? 'text-red-500' : 'text-[#0F6E56]'}`}>
                  {change.startsWith('-') ? '▼' : '▲'} {change}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Margins & profitability</div>
          {[
            { label: 'Gross margin', val: mg.grossMargin },
            { label: 'Operating margin', val: mg.operatingMargin },
          ].filter(r => r.val && !isMuted(r.val)).map(({ label, val }) => (
            <div key={label} className="flex items-baseline py-2 border-b border-gray-50 dark:border-gray-800">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-36 shrink-0">{label}</span>
              <span className="text-sm font-semibold">{val}</span>
            </div>
          ))}
          {mg.trend && !isMuted(mg.trend) && (
            <p className="text-xs text-gray-400 leading-relaxed mt-3">{mg.trend}</p>
          )}
        </div>
      </div>

      {/* Key findings — explicit risks */}
      {rw.explicitRisks.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Key findings</div>
          <div className="space-y-3">
            {rw.explicitRisks.map((finding: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[#1D9E75]" />
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{finding}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash flow + Strategic direction grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Cash flow</div>
          {cf.profitToCashConversion && !isMuted(cf.profitToCashConversion) && (
            <div className="flex items-start py-2 border-b border-gray-50 dark:border-gray-800">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-36 shrink-0">Conversion</span>
              <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{cf.profitToCashConversion}</span>
            </div>
          )}
          {cf.capex && !isMuted(cf.capex) && (
            <div className="flex items-start py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-36 shrink-0">Capex</span>
              <span className="text-sm font-semibold">{cf.capex}</span>
            </div>
          )}
          {cf.summary && !isMuted(cf.summary) && (
            <p className="text-xs text-gray-400 leading-relaxed mt-2">{cf.summary}</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Strategic direction</div>
          {sd.managementOutlook && !isMuted(sd.managementOutlook) && (
            <div className="flex items-start py-2 border-b border-gray-50 dark:border-gray-800">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-28 shrink-0">Outlook</span>
              <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{sd.managementOutlook}</span>
            </div>
          )}
          {sd.marketsOrGeographies && !isMuted(sd.marketsOrGeographies) && (
            <div className="flex items-start py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400 w-28 shrink-0">Markets</span>
              <span className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{sd.marketsOrGeographies}</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
