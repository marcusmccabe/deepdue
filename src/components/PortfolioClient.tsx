"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  computePortfolio,
  healthPillColours,
  FLAG_LABELS,
  type PortfolioFlag,
} from "@/lib/portfolio-health";
import type { AccountsAnalysis } from "@/lib/analysis-types";

export type PortfolioCompanyRow = {
  id: string;
  company_number: string;
  company_name: string;
  added_at: string;
  analysis_status: string;
  last_analysed_at: string | null;
  has_documents: boolean;
};

export type PortfolioClientProps = {
  portfolioId: string | null;
  companies: PortfolioCompanyRow[];
  analysisByCompany: Record<string, AccountsAnalysis | null>;
};

type ParsedRow = { company_name: string; company_number: string };

const FILTER_PILLS: Array<{ key: "all" | PortfolioFlag; label: string }> = [
  { key: "all", label: "All" },
  { key: "going_concern", label: "Going concern" },
  { key: "director_flags", label: "Director flags" },
  { key: "gazette_notice", label: "Gazette notice" },
  { key: "declining_margin", label: "Declining margin" },
];

export default function PortfolioClient({
  portfolioId,
  companies,
  analysisByCompany,
}: PortfolioClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [filter, setFilter] = useState<"all" | PortfolioFlag>("all");
  const [importOpen, setImportOpen] = useState(false);

  // Computed rows
  const enriched = useMemo(() => {
    return companies.map((c) => {
      const analysis = analysisByCompany[c.company_number] ?? null;
      const computed = computePortfolio(analysis);
      const lastAccountsDate = analysis?.documentDate ?? null;
      return { ...c, ...computed, lastAccountsDate, hasAnalysis: !!analysis };
    });
  }, [companies, analysisByCompany]);

  const filtered = useMemo(() => {
    if (filter === "all") return enriched;
    return enriched.filter((r) => r.flags.includes(filter));
  }, [enriched, filter]);

  // Stats
  const stats = useMemo(() => {
    const total = enriched.length;
    const goingConcern = enriched.filter((r) => r.hasGoingConcern).length;
    const critical = enriched.filter(
      (r) => r.hasAnalysis && (r.healthScore < 30 || r.hasGoingConcern)
    ).length;
    const healthy = enriched.filter(
      (r) => r.hasAnalysis && r.healthScore > 70 && r.flags.length === 0
    ).length;
    return { total, goingConcern, critical, healthy };
  }, [enriched]);

  const isEmpty = companies.length === 0;

  return (
    <>
      {/* Header row with Import button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily:
                'var(--font-instrument-serif), "Instrument Serif", serif',
              fontSize: "26px",
              fontWeight: 400,
              color: "#0f172a",
              lineHeight: 1.2,
              marginBottom: "4px",
            }}
          >
            Portfolio
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            {isEmpty
              ? "Bulk-monitor every client in one view"
              : `${companies.length} ${companies.length === 1 ? "client" : "clients"}`}
          </p>
        </div>
        {!isEmpty && (
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            style={primaryButtonStyle}
          >
            Import clients
          </button>
        )}
      </div>

      {isEmpty ? (
        <EmptyState onImport={() => setImportOpen(true)} />
      ) : (
        <>
          <StatsRow stats={stats} />
          <FilterPills value={filter} onChange={setFilter} />
          <ClientTable
            rows={filtered}
            onAnalyse={(numbers) =>
              startTransition(() => {
                runBulkAnalyse(portfolioId!, numbers, () => router.refresh());
              })
            }
          />
          <AskAIBar portfolioId={portfolioId!} />
        </>
      )}

      {importOpen && (
        <ImportModal
          portfolioId={portfolioId}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
        padding: "64px 32px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "36px", marginBottom: "12px" }}>📁</div>
      <div
        style={{
          fontFamily:
            'var(--font-instrument-serif), "Instrument Serif", serif',
          fontSize: "22px",
          color: "#0f172a",
          marginBottom: "8px",
        }}
      >
        No clients in your portfolio yet
      </div>
      <div
        style={{
          fontSize: "13px",
          color: "#64748b",
          marginBottom: "24px",
          maxWidth: "440px",
          margin: "0 auto 24px",
        }}
      >
        Import your client list as a CSV and we&rsquo;ll analyse every set of
        accounts so you can spot risks across the whole book in seconds.
      </div>
      <div
        style={{
          display: "flex",
          gap: "12px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button type="button" onClick={onImport} style={primaryButtonStyle}>
          Import clients
        </button>
        <a href="/portfolio/template.csv" download style={secondaryLinkStyle}>
          Download template
        </a>
      </div>
    </div>
  );
}

// ── Stats row ──────────────────────────────────────────────────────────────
function StatsRow({
  stats,
}: {
  stats: { total: number; critical: number; goingConcern: number; healthy: number };
}) {
  const cards = [
    { label: "Total clients", value: stats.total, tone: "neutral" as const },
    { label: "Critical flags", value: stats.critical, tone: "red" as const },
    { label: "Going concern", value: stats.goingConcern, tone: "amber" as const },
    { label: "Healthy", value: stats.healthy, tone: "green" as const },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "14px",
        marginBottom: "24px",
      }}
    >
      {cards.map((c) => {
        const accent =
          c.tone === "red"
            ? "#A32D2D"
            : c.tone === "amber"
            ? "#854F0B"
            : c.tone === "green"
            ? "#3B6D11"
            : "#0f172a";
        return (
          <div
            key={c.label}
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "16px 18px",
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#94a3b8",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                fontSize: "32px",
                fontWeight: 800,
                color: accent,
                lineHeight: 1,
              }}
            >
              {c.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Filter pills ───────────────────────────────────────────────────────────
function FilterPills({
  value,
  onChange,
}: {
  value: "all" | PortfolioFlag;
  onChange: (v: "all" | PortfolioFlag) => void;
}) {
  return (
    <div
      style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}
    >
      {FILTER_PILLS.map((p) => {
        const active = value === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              padding: "6px 14px",
              borderRadius: "100px",
              border: active ? "1px solid #5B5BD6" : "1px solid #e2e8f0",
              backgroundColor: active ? "rgba(91,91,214,0.10)" : "#ffffff",
              color: active ? "#5B5BD6" : "#475569",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Client table ───────────────────────────────────────────────────────────
type EnrichedRow = PortfolioCompanyRow & {
  healthScore: number;
  flags: PortfolioFlag[];
  hasGoingConcern: boolean;
  lastAccountsDate: string | null;
  hasAnalysis: boolean;
};

function ClientTable({
  rows,
  onAnalyse,
}: {
  rows: EnrichedRow[];
  onAnalyse: (numbers: string[]) => void;
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "40px",
          textAlign: "center",
          color: "#94a3b8",
          fontSize: "13px",
          marginBottom: "120px",
        }}
      >
        No clients match this filter.
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
        overflow: "hidden",
        marginBottom: "120px",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Company", "Health", "Flags", "Last accounts", "Private docs", ""].map(
              (col) => (
                <th
                  key={col}
                  style={{
                    padding: "10px 18px",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#94a3b8",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    borderBottom: "1px solid #e2e8f0",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              style={{
                borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : "none",
              }}
            >
              <td style={{ padding: "14px 18px" }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#0f172a",
                    marginBottom: "2px",
                  }}
                >
                  <a
                    href={`/company/${row.company_number}`}
                    style={{ color: "#0f172a", textDecoration: "none" }}
                  >
                    {row.company_name}
                  </a>
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  {row.company_number}
                </div>
              </td>
              <td style={{ padding: "14px 18px" }}>
                {row.hasAnalysis ? <HealthPill score={row.healthScore} /> : <Dim>—</Dim>}
              </td>
              <td style={{ padding: "14px 18px" }}>
                {row.flags.length === 0 ? (
                  <Dim>—</Dim>
                ) : (
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {row.flags.map((f) => (
                      <span
                        key={f}
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: "100px",
                          backgroundColor: "rgba(220,38,38,0.10)",
                          color: "#dc2626",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {FLAG_LABELS[f]}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td
                style={{
                  padding: "14px 18px",
                  fontSize: "13px",
                  color: "#475569",
                  whiteSpace: "nowrap",
                }}
              >
                {row.lastAccountsDate
                  ? new Date(row.lastAccountsDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </td>
              <td style={{ padding: "14px 18px", fontSize: "14px" }}>
                {row.has_documents ? (
                  <span title="Private documents uploaded">📎</span>
                ) : (
                  <Dim>—</Dim>
                )}
              </td>
              <td style={{ padding: "14px 18px", textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => onAnalyse([row.company_number])}
                  disabled={row.analysis_status === "analysing"}
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: row.analysis_status === "analysing" ? "#94a3b8" : "#5B5BD6",
                    background: "none",
                    border: row.analysis_status === "analysing"
                      ? "1px solid #e2e8f0"
                      : "1px solid rgba(91,91,214,0.25)",
                    borderRadius: "6px",
                    padding: "5px 12px",
                    cursor: row.analysis_status === "analysing" ? "default" : "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "inherit",
                  }}
                >
                  {row.analysis_status === "analysing"
                    ? "Analysing…"
                    : row.hasAnalysis
                    ? "Re-analyse"
                    : "Analyse"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HealthPill({ score }: { score: number }) {
  const { bg, color } = healthPillColours(score);
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "12px",
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: "100px",
        backgroundColor: bg,
        color,
        minWidth: "44px",
        textAlign: "center",
      }}
    >
      {score}
    </span>
  );
}

function Dim({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "#94a3b8", fontSize: "13px" }}>{children}</span>;
}

// ── Ask AI bar ─────────────────────────────────────────────────────────────
function AskAIBar({ portfolioId }: { portfolioId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setError(null);
    setAnswer("");
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch("/api/portfolio/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio_id: portfolioId, question: question.trim() }),
      });
      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "220px",
        right: 0,
        backgroundColor: "#ffffff",
        borderTop: "1px solid #e2e8f0",
        boxShadow: "0 -4px 16px rgba(0,0,0,0.06)",
        zIndex: 5,
      }}
    >
      {open && (answer || error) && (
        <div
          style={{
            maxHeight: "260px",
            overflowY: "auto",
            padding: "16px 24px",
            borderBottom: "1px solid #f1f5f9",
            backgroundColor: "#fafaff",
          }}
        >
          {error && (
            <div style={{ color: "#dc2626", fontSize: "13px" }}>{error}</div>
          )}
          {answer && (
            <div
              style={{
                fontSize: "13px",
                color: "#0f172a",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {answer}
              {loading && (
                <span style={{ color: "#94a3b8", marginLeft: "4px" }}>▍</span>
              )}
            </div>
          )}
        </div>
      )}
      <form
        onSubmit={ask}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "14px 24px",
        }}
      >
        <span style={{ fontSize: "16px" }}>✨</span>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Which of my clients have a going concern note?"
          style={{
            flex: 1,
            fontSize: "13px",
            padding: "10px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            fontFamily: "inherit",
            color: "#0f172a",
            outline: "none",
          }}
        />
        {open && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAnswer("");
              setError(null);
            }}
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Clear
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            ...primaryButtonStyle,
            opacity: loading || !question.trim() ? 0.5 : 1,
            cursor: loading || !question.trim() ? "default" : "pointer",
          }}
        >
          {loading ? "Asking…" : "Ask"}
        </button>
      </form>
    </div>
  );
}

// ── Import modal + bulk analyse runner ────────────────────────────────────
function ImportModal({
  portfolioId,
  onClose,
  onImported,
}: {
  portfolioId: string | null;
  onClose: () => void;
  onImported: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [stage, setStage] = useState<"choose" | "preview" | "importing" | "analysing" | "done">(
    "choose"
  );
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const rows = parseCsv(text);
        if (rows.length === 0) {
          setParseError("No rows found in the CSV.");
          return;
        }
        setParsed(rows);
        setStage("preview");
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    setErrorMsg(null);
    setStage("importing");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg("You must be signed in.");
      setStage("preview");
      return;
    }

    let activePortfolioId = portfolioId;
    if (!activePortfolioId) {
      const { data: created, error: insertErr } = await supabase
        .from("portfolios")
        .insert({ user_id: user.id, name: "My portfolio" })
        .select("id")
        .single();
      if (insertErr || !created) {
        setErrorMsg(insertErr?.message ?? "Failed to create portfolio");
        setStage("preview");
        return;
      }
      activePortfolioId = created.id;
    }

    const rowsToInsert = parsed.map((r) => ({
      portfolio_id: activePortfolioId,
      user_id: user.id,
      company_number: r.company_number.toUpperCase(),
      company_name: r.company_name,
      analysis_status: "pending",
    }));

    const { error: upsertErr } = await supabase
      .from("portfolio_companies")
      .upsert(rowsToInsert, { onConflict: "portfolio_id,company_number" });

    if (upsertErr) {
      setErrorMsg(upsertErr.message);
      setStage("preview");
      return;
    }

    setStage("analysing");
    setProgress({ current: 0, total: parsed.length });

    await runBulkAnalyse(
      activePortfolioId!,
      parsed.map((r) => r.company_number.toUpperCase()),
      undefined,
      (p) => setProgress(p)
    );

    setStage("done");
    setTimeout(() => onImported(), 600);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "80vh",
          overflow: "auto",
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontFamily:
                'var(--font-instrument-serif), "Instrument Serif", serif',
              fontSize: "20px",
              color: "#0f172a",
            }}
          >
            Import clients
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              color: "#94a3b8",
              cursor: "pointer",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {stage === "choose" && (
          <>
            <p style={{ fontSize: "13px", color: "#475569", marginBottom: "16px" }}>
              Upload a CSV with two columns: <code>company_name</code> and{" "}
              <code>company_number</code>.{" "}
              <a
                href="/portfolio/template.csv"
                download
                style={{ color: "#5B5BD6", textDecoration: "none", fontWeight: 600 }}
              >
                Download template
              </a>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              style={{ fontSize: "13px" }}
            />
            {parseError && (
              <div style={{ fontSize: "13px", color: "#dc2626", marginTop: "12px" }}>
                {parseError}
              </div>
            )}
          </>
        )}

        {stage === "preview" && (
          <>
            <p style={{ fontSize: "13px", color: "#475569", marginBottom: "12px" }}>
              Preview — {parsed.length} {parsed.length === 1 ? "row" : "rows"} ready
              to import.
            </p>
            <div
              style={{
                maxHeight: "320px",
                overflowY: "auto",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead style={{ position: "sticky", top: 0, background: "#f8fafc" }}>
                  <tr>
                    <th style={previewThStyle}>Company name</th>
                    <th style={previewThStyle}>Company number</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={previewTdStyle}>{r.company_name}</td>
                      <td
                        style={{
                          ...previewTdStyle,
                          fontFamily: "'Courier New', monospace",
                        }}
                      >
                        {r.company_number}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errorMsg && (
              <div style={{ fontSize: "13px", color: "#dc2626", marginTop: "12px" }}>
                {errorMsg}
              </div>
            )}
            <div
              style={{
                marginTop: "16px",
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button type="button" onClick={() => setStage("choose")} style={ghostButtonStyle}>
                Choose another file
              </button>
              <button type="button" onClick={confirmImport} style={primaryButtonStyle}>
                Import &amp; analyse
              </button>
            </div>
          </>
        )}

        {stage === "importing" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: "13px", color: "#475569" }}>Saving clients…</div>
          </div>
        )}

        {stage === "analysing" && (
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: "13px", color: "#0f172a", marginBottom: "10px" }}>
              Analysing {progress.current} of {progress.total}…
            </div>
            <div
              style={{
                height: "6px",
                background: "#f1f5f9",
                borderRadius: "100px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress.total === 0 ? 0 : (progress.current / progress.total) * 100}%`,
                  background: "#5B5BD6",
                  transition: "width 200ms ease",
                }}
              />
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "8px" }}>
              You can close this dialog — analysis will continue in the background.
            </div>
          </div>
        )}

        {stage === "done" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>✓</div>
            <div style={{ fontSize: "13px", color: "#0f172a" }}>Import complete.</div>
          </div>
        )}
      </div>
    </div>
  );
}

const previewThStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
const previewTdStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "12px",
  color: "#0f172a",
};

// ── CSV parsing ────────────────────────────────────────────────────────────
function parseCsv(text: string): ParsedRow[] {
  // Strip BOM, normalise newlines
  const cleaned = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!cleaned) return [];

  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inQuotes) {
      if (ch === '"' && cleaned[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        records.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  row.push(field);
  records.push(row);

  if (records.length === 0) return [];
  const header = records[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("company_name");
  const numberIdx = header.indexOf("company_number");
  if (nameIdx === -1 || numberIdx === -1) {
    throw new Error('CSV must include "company_name" and "company_number" header columns');
  }

  const out: ParsedRow[] = [];
  for (let r = 1; r < records.length; r++) {
    const cells = records[r];
    const name = (cells[nameIdx] ?? "").trim();
    const number = (cells[numberIdx] ?? "").trim();
    if (!name && !number) continue;
    if (!name || !number) continue;
    out.push({ company_name: name, company_number: number });
  }
  return out;
}

// ── Bulk analyse client helper ─────────────────────────────────────────────
async function runBulkAnalyse(
  portfolioId: string,
  companyNumbers: string[],
  onComplete?: () => void,
  onProgress?: (p: { current: number; total: number }) => void
) {
  if (companyNumbers.length === 0) return;
  try {
    const res = await fetch("/api/portfolio/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolio_id: portfolioId, company_numbers: companyNumbers }),
    });
    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = 0;
    let total = companyNumbers.length;

    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "start") total = event.total;
          if (event.type === "progress") {
            done += 1;
            onProgress?.({ current: done, total });
          }
        } catch {
          // skip
        }
      }
    }
  } finally {
    onComplete?.();
  }
}

// ── Shared styles ──────────────────────────────────────────────────────────
const primaryButtonStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#ffffff",
  backgroundColor: "#5B5BD6",
  border: "none",
  borderRadius: "8px",
  padding: "9px 16px",
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryLinkStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#5B5BD6",
  textDecoration: "none",
  border: "1px solid rgba(91,91,214,0.25)",
  borderRadius: "8px",
  padding: "9px 16px",
  display: "inline-flex",
  alignItems: "center",
};

const ghostButtonStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#475569",
  background: "none",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "9px 16px",
  cursor: "pointer",
  fontFamily: "inherit",
};
