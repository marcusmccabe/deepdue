"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { AccountsAnalysis, AnalysisRisk } from "@/lib/analysis-types";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtCurrency(value: number | null | undefined, currency = "GBP"): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  const symbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";
  let formatted: string;
  if (abs >= 1_000_000_000) {
    formatted = (value / 1_000_000_000).toFixed(2) + "bn";
  } else if (abs >= 1_000_000) {
    formatted = (value / 1_000_000).toFixed(2) + "m";
  } else if (abs >= 1_000) {
    formatted = (value / 1_000).toFixed(1) + "k";
  } else {
    formatted = value.toLocaleString("en-GB");
  }
  return `${symbol}${formatted}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: AnalysisRisk["severity"] }) {
  const cfg = {
    high: { label: "High", color: "#dc2626", bg: "rgba(220,38,38,0.09)" },
    medium: { label: "Medium", color: "#d97706", bg: "rgba(217,119,6,0.09)" },
    low: { label: "Low", color: "#4f46e5", bg: "rgba(79,70,229,0.09)" },
  } as const;
  const { label, color, bg } = cfg[severity] ?? cfg.low;
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: "700",
        color,
        backgroundColor: bg,
        padding: "2px 8px",
        borderRadius: "100px",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function AuditBadge({ opinion }: { opinion: AccountsAnalysis["auditOpinion"] }) {
  const cfg: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    clean: { label: "Clean Opinion", color: "#059669", bg: "rgba(5,150,105,0.09)", icon: "✓" },
    qualified: { label: "Qualified Opinion", color: "#d97706", bg: "rgba(217,119,6,0.09)", icon: "⚠" },
    adverse: { label: "Adverse Opinion", color: "#dc2626", bg: "rgba(220,38,38,0.09)", icon: "✗" },
    disclaimer: { label: "Disclaimer of Opinion", color: "#dc2626", bg: "rgba(220,38,38,0.09)", icon: "✗" },
    unknown: { label: "Opinion Unknown", color: "#94a3b8", bg: "rgba(148,163,184,0.09)", icon: "?" },
  };
  const c = cfg[opinion] ?? cfg.unknown;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "12px",
        fontWeight: "600",
        color: c.color,
        backgroundColor: c.bg,
        padding: "4px 11px",
        borderRadius: "100px",
        border: `1px solid ${c.color}44`,
      }}
    >
      {c.icon} {c.label}
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: AccountsAnalysis["managementSentiment"] }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    positive: { label: "Positive Outlook", color: "#059669", bg: "rgba(5,150,105,0.09)" },
    cautious: { label: "Cautious Outlook", color: "#d97706", bg: "rgba(217,119,6,0.09)" },
    mixed: { label: "Mixed Outlook", color: "#d97706", bg: "rgba(217,119,6,0.09)" },
    negative: { label: "Negative Outlook", color: "#dc2626", bg: "rgba(220,38,38,0.09)" },
    unknown: { label: "Sentiment Unknown", color: "#94a3b8", bg: "rgba(148,163,184,0.09)" },
  };
  const c = cfg[sentiment] ?? cfg.unknown;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "11px",
        fontWeight: "600",
        color: c.color,
        backgroundColor: c.bg,
        padding: "3px 10px",
        borderRadius: "100px",
      }}
    >
      {c.label}
    </span>
  );
}

// ── Shared card chrome ────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
  overflow: "hidden",
};

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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "10px",
        fontWeight: "600",
        color: "#94a3b8",
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        marginBottom: "8px",
      }}
    >
      {children}
    </div>
  );
}

function AlertBox({
  color,
  bg,
  border,
  title,
  children,
}: {
  color: string;
  bg: string;
  border: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${border}`,
        backgroundColor: bg,
        borderRadius: "0 8px 8px 0",
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: "700",
          color,
          marginBottom: "4px",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.55" }}>
        {children}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  companyNumber: string;
}

type Status = "loading" | "success" | "not-found" | "error";

export default function AIAnalysisCard({ companyNumber }: Props) {
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
          <AlertBox color="#0f172a" bg="rgba(220,38,38,0.05)" border="#dc2626" title="Analysis failed">
            {errorMsg || "An unexpected error occurred. Please try refreshing."}
          </AlertBox>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (!analysis) return null;

  const currency = analysis.financials.currency ?? "GBP";
  const highRisks = analysis.risks.filter((r) => r.severity === "high").length;
  const badgeLabel = highRisks > 0 ? `${highRisks} high risk${highRisks > 1 ? "s" : ""}` : "Analysis complete";
  const badgeColor = highRisks > 0 ? "#dc2626" : "#059669";
  const badgeBg = highRisks > 0 ? "rgba(220,38,38,0.08)" : "rgba(5,150,105,0.08)";

  const runway = analysis.cashFlowAnalysis?.cashRunwayMonths ?? null;
  const runwayColor = runway === null ? "#475569" : runway < 12 ? "#dc2626" : runway < 24 ? "#d97706" : "#059669";

  const VERDICT_CFG: Record<string, { bg: string; border: string; color: string; dot: string }> = {
    low:      { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", dot: "#22c55e" },
    medium:   { bg: "#fffbeb", border: "#fde68a", color: "#92400e", dot: "#f59e0b" },
    high:     { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", dot: "#ef4444" },
    critical: { bg: "#fee2e2", border: "#f87171", color: "#7f1d1d", dot: "#dc2626" },
  };
  const verdictCfg = VERDICT_CFG[analysis.verdictRating ?? "medium"] ?? VERDICT_CFG.medium;
  const hasKeyNumbers =
    analysis.financials.revenue !== null ||
    analysis.financials.profit !== null ||
    analysis.financials.cash !== null;
  const primaryRisk = analysis.risks.find((r: AnalysisRisk) => r.severity === "high");

  return (
    <div style={CARD}>
      <CardHeader badge={<Pill label={`✓ ${badgeLabel}`} color={badgeColor} bg={badgeBg} />} />

      {/* ── Verdict banner ── */}
      {analysis.verdict && (
        <div
          style={{
            backgroundColor: verdictCfg.bg,
            borderTop: `1px solid ${verdictCfg.border}`,
            borderBottom: `1px solid ${verdictCfg.border}`,
            padding: "11px 18px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: verdictCfg.dot,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "13px", fontWeight: "600", color: verdictCfg.color, lineHeight: "1.4" }}>
            {analysis.verdict}
          </span>
        </div>
      )}

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ── Three key numbers ── */}
        {hasKeyNumbers && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            {(
              [
                { label: "Revenue",          value: analysis.financials.revenue, isNeg: false },
                { label: "Net Profit / Loss", value: analysis.financials.profit,  isNeg: (analysis.financials.profit ?? 0) < 0 },
                { label: "Cash",             value: analysis.financials.cash,    isNeg: false },
              ] as { label: string; value: number | null; isNeg: boolean }[]
            ).map(({ label, value, isNeg }) => (
              <div
                key={label}
                style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: "8px",
                  padding: "12px 10px",
                  textAlign: "center",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: "17px",
                    fontWeight: "800",
                    color: value === null ? "#94a3b8" : isNeg ? "#dc2626" : "#0f172a",
                    marginBottom: "4px",
                    lineHeight: "1.2",
                  }}
                >
                  {value !== null ? fmtCurrency(value, currency) : "—"}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: "600",
                    color: "#94a3b8",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Primary risk callout ── */}
        {primaryRisk && (
          <div
            style={{
              borderLeft: "3px solid #dc2626",
              backgroundColor: "rgba(220,38,38,0.05)",
              borderRadius: "0 8px 8px 0",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                fontWeight: "700",
                color: "#dc2626",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Primary Risk
            </div>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginBottom: "4px" }}>
              {primaryRisk.title}
            </div>
            <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.55" }}>
              {primaryRisk.detail}
            </div>
          </div>
        )}

        {/* ── Going concern ── */}
        {analysis.goingConcern && analysis.auditOpinion !== "clean" && (
          <div
            style={{
              backgroundColor: "rgba(217,119,6,0.07)",
              border: "1px solid rgba(217,119,6,0.30)",
              borderRadius: "8px",
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#92400e", marginBottom: "4px" }}>
                  Going Concern Note Identified
                </div>
                <div style={{ fontSize: "12px", color: "#78350f", lineHeight: "1.55" }}>
                  {analysis.goingConcernDetail ||
                    "Auditors have flagged material uncertainty about this company's ability to continue as a going concern."}
                </div>
                {analysis.goingConcernRunwayMonths !== null && (
                  <div style={{ fontSize: "12px", color: "#92400e", marginTop: "6px", fontWeight: "600" }}>
                    Estimated runway: {analysis.goingConcernRunwayMonths} months based on current cash position
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Audit opinion ── */}
        <div>
          <Label>Audit Opinion</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <AuditBadge opinion={analysis.auditOpinion} />
              {analysis.auditorChanged === true && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#dc2626",
                    backgroundColor: "rgba(220,38,38,0.08)",
                    padding: "3px 8px",
                    borderRadius: "100px",
                    border: "1px solid rgba(220,38,38,0.25)",
                  }}
                >
                  ⚠ Auditor changed this year
                </span>
              )}
            </div>
            {analysis.auditorName && (
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Audited by <span style={{ fontWeight: "600", color: "#0f172a" }}>{analysis.auditorName}</span>
              </div>
            )}
            {analysis.emphasisOfMatter && (
              <div
                style={{
                  backgroundColor: "rgba(217,119,6,0.07)",
                  border: "1px solid rgba(217,119,6,0.25)",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  marginTop: "2px",
                }}
              >
                <div style={{ fontSize: "10px", fontWeight: "700", color: "#d97706", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px" }}>
                  Emphasis of Matter
                </div>
                <div style={{ fontSize: "12px", color: "#78350f", lineHeight: "1.55" }}>
                  {analysis.emphasisOfMatter}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Summary + sentiment ── */}
        {analysis.summary && (
          <div>
            <Label>Summary</Label>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.65", margin: "0 0 10px" }}>
              {analysis.summary}
            </p>
            {analysis.managementSentiment && analysis.managementSentiment !== "unknown" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <SentimentBadge sentiment={analysis.managementSentiment} />
                {analysis.managementSentimentDetail && (
                  <div style={{ fontSize: "11px", color: "#94a3b8", lineHeight: "1.55" }}>
                    {analysis.managementSentimentDetail}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Year on year ── */}
        {analysis.yearOnYearNarrative && (
          <div>
            <Label>Year on Year Analysis</Label>
            <p style={{ fontSize: "13px", color: "#334155", lineHeight: "1.7", margin: 0 }}>
              {analysis.yearOnYearNarrative}
            </p>
          </div>
        )}

        {/* ── Risks ── */}
        {analysis.risks.length > 0 && (
          <div>
            <Label>Risks Identified ({analysis.risks.length})</Label>
            <div style={{ display: "flex", gap: "12px", marginBottom: "10px", fontSize: "12px", fontWeight: "600" }}>
              {(["high", "medium", "low"] as const).map((sev) => {
                const count = analysis.risks.filter((r) => r.severity === sev).length;
                const color = sev === "high" ? "#dc2626" : sev === "medium" ? "#d97706" : "#4f46e5";
                return (
                  <span key={sev} style={{ color }}>
                    {count} {sev}
                  </span>
                );
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {analysis.risks.map((risk, i) => {
                const borderColor = risk.severity === "high" ? "#dc2626" : risk.severity === "medium" ? "#d97706" : "#4f46e5";
                const bgColor = risk.severity === "high" ? "rgba(220,38,38,0.05)" : risk.severity === "medium" ? "rgba(217,119,6,0.05)" : "rgba(79,70,229,0.05)";
                return (
                  <div
                    key={i}
                    style={{
                      borderLeft: `3px solid ${borderColor}`,
                      backgroundColor: bgColor,
                      borderRadius: "0 8px 8px 0",
                      padding: "10px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                      <SeverityBadge severity={risk.severity} />
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>
                        {risk.title}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569", lineHeight: "1.55" }}>
                      {risk.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Director loans ── */}
        {analysis.directorLoans?.present && (
          <div>
            <Label>Director Loans</Label>
            <AlertBox color="#92400e" bg="rgba(217,119,6,0.06)" border="#d97706" title="Director Loans Identified">
              {analysis.directorLoans.detail}
              {analysis.directorLoans.totalValue !== null && (
                <div style={{ marginTop: "6px", fontWeight: "600", color: "#92400e" }}>
                  Total value: {fmtCurrency(analysis.directorLoans.totalValue, currency)}
                </div>
              )}
            </AlertBox>
          </div>
        )}

        {/* ── Related party transactions ── */}
        {analysis.relatedPartyTransactions?.present && (
          <div>
            <Label>Related Party Transactions</Label>
            <AlertBox color="#92400e" bg="rgba(217,119,6,0.06)" border="#d97706" title="Related Party Transactions">
              {analysis.relatedPartyTransactions.detail}
            </AlertBox>
          </div>
        )}

        {/* ── Legal proceedings ── */}
        {analysis.legalProceedings?.present && (
          <div>
            <Label>Legal Proceedings</Label>
            <AlertBox color="#7f1d1d" bg="rgba(220,38,38,0.05)" border="#dc2626" title="⚖ Legal Proceedings">
              {analysis.legalProceedings.detail}
            </AlertBox>
          </div>
        )}

        {/* ── Cyber & operational risk ── */}
        {analysis.cyberOrOperationalRisk?.present && (
          <div>
            <Label>Cyber &amp; Operational Risk</Label>
            <AlertBox color="#7f1d1d" bg="rgba(220,38,38,0.05)" border="#dc2626" title="🔒 Cyber & Operational Risk">
              {analysis.cyberOrOperationalRisk.detail}
            </AlertBox>
          </div>
        )}

        {/* ── Cash flow intelligence ── */}
        {analysis.cashFlowAnalysis && (
          <div>
            <Label>Cash Flow Intelligence</Label>
            <div
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                {analysis.cashFlowAnalysis.operatingCashFlow !== null && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#475569" }}>Operating cash flow</span>
                    <span
                      style={{
                        fontWeight: "600",
                        color: (analysis.cashFlowAnalysis.operatingCashFlow ?? 0) >= 0 ? "#059669" : "#dc2626",
                      }}
                    >
                      {fmtCurrency(analysis.cashFlowAnalysis.operatingCashFlow, currency)}
                    </span>
                  </div>
                )}
                {analysis.cashFlowAnalysis.freeCashFlow !== null && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#475569" }}>Free cash flow</span>
                    <span
                      style={{
                        fontWeight: "600",
                        color: (analysis.cashFlowAnalysis.freeCashFlow ?? 0) >= 0 ? "#059669" : "#dc2626",
                      }}
                    >
                      {fmtCurrency(analysis.cashFlowAnalysis.freeCashFlow, currency)}
                    </span>
                  </div>
                )}
                {analysis.cashFlowAnalysis.cashBurnMonthly !== null && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#475569" }}>Monthly cash burn</span>
                    <span style={{ fontWeight: "600", color: "#dc2626" }}>
                      {fmtCurrency(analysis.cashFlowAnalysis.cashBurnMonthly, currency)}
                    </span>
                  </div>
                )}
                {runway !== null && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      borderBottom: analysis.cashFlowAnalysis.detail ? "1px solid #f1f5f9" : "none",
                      fontSize: "12px",
                    }}
                  >
                    <span style={{ color: "#475569" }}>Estimated runway</span>
                    <span style={{ fontWeight: "700", color: runwayColor }}>
                      {runway} months
                    </span>
                  </div>
                )}
                {analysis.cashFlowAnalysis.detail && (
                  <div style={{ padding: "10px 12px", fontSize: "12px", color: "#475569", lineHeight: "1.6" }}>
                    {analysis.cashFlowAnalysis.detail}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Revenue concentration ── */}
        {analysis.revenueConcentration?.concentrated === true && (
          <div>
            <Label>Revenue Concentration</Label>
            <AlertBox color="#92400e" bg="rgba(217,119,6,0.06)" border="#d97706" title="Revenue Concentration Risk">
              {analysis.revenueConcentration.detail}
            </AlertBox>
          </div>
        )}

        {/* ── Sector context ── */}
        {analysis.sectorBenchmarkCommentary && (
          <div>
            <Label>Sector Context</Label>
            <div
              style={{
                borderLeft: "3px solid #4f46e5",
                backgroundColor: "rgba(79,70,229,0.04)",
                borderRadius: "0 8px 8px 0",
                padding: "12px 14px",
                fontSize: "12px",
                color: "#334155",
                lineHeight: "1.6",
              }}
            >
              {analysis.sectorBenchmarkCommentary}
            </div>
          </div>
        )}

        {/* ── Key events ── */}
        {analysis.keyEvents.length > 0 && (
          <div>
            <Label>Key Events</Label>
            <ul
              style={{
                margin: 0,
                paddingLeft: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
              }}
            >
              {analysis.keyEvents.map((event, i) => (
                <li key={i} style={{ fontSize: "13px", color: "#475569", lineHeight: "1.55" }}>
                  {event}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Conclusion / Assessment ── */}
        {analysis.conclusion && (
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                fontWeight: "700",
                color: "#94a3b8",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Assessment
            </div>
            <p style={{ fontSize: "13px", color: "#334155", lineHeight: "1.7", margin: 0 }}>
              {analysis.conclusion}
            </p>
          </div>
        )}

        {/* ── Footer ── */}
        <div
          style={{
            borderTop: "1px solid #f1f5f9",
            paddingTop: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            Analysis run{" "}
            {new Date(analysis.analysedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {analysis.cached ? " · Cached result" : " · Cached for 24 hours"}
            {analysis.documentDate && (
              <>
                {" · Accounts filed "}
                {new Date(analysis.documentDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </>
            )}
          </span>

          <Link
            href={`/company/${companyNumber}/financials`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "10px 18px",
              backgroundColor: "#4f46e5",
              color: "#ffffff",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "700",
              letterSpacing: "0.01em",
              textDecoration: "none",
            }}
          >
            View Full Financials →
          </Link>
        </div>
      </div>
    </div>
  );
}
