"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { AccountsAnalysis } from "@/lib/analysis-types";

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

function AuditBadge({ opinion }: { opinion: string }) {
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

  const snap = analysis.financialSnapshot;
  const audit = analysis.auditOpinion;
  const gc = analysis.goingConcern;
  const dl = analysis.directorLoans;
  const rpt = analysis.relatedPartyTransactions;

  const snapFields: { label: string; value: number | null | undefined }[] = snap
    ? [
        { label: "Revenue", value: snap.revenue },
        { label: "Gross Profit", value: snap.grossProfit },
        { label: "Operating Profit", value: snap.operatingProfit },
        { label: "Net Profit", value: snap.netProfit },
        { label: "Cash", value: snap.cash },
        { label: "Net Assets", value: snap.netAssets },
        { label: "Total Debt", value: snap.totalDebt },
        { label: "Employees", value: snap.employeeCount },
      ]
    : [];
  const visibleSnap = snapFields.filter((f) => f.value !== null && f.value !== undefined);

  return (
    <div style={CARD}>
      <CardHeader badge={<Pill label="✓ Analysis complete" color="#059669" bg="rgba(5,150,105,0.08)" />} />

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ── Financial Snapshot ── */}
        {visibleSnap.length > 0 && (
          <div>
            <Label>Financial Snapshot</Label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              {visibleSnap.map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    backgroundColor: "#f8fafc",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: "600",
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "4px",
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: "800",
                      color:
                        label === "Employees"
                          ? "#0f172a"
                          : (value ?? 0) < 0
                          ? "#dc2626"
                          : "#0f172a",
                      lineHeight: "1.2",
                    }}
                  >
                    {label === "Employees"
                      ? (value ?? 0).toLocaleString("en-GB")
                      : fmtCurrency(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Key Movements ── */}
        {(analysis.keyMovements ?? []).length > 0 && (
          <div>
            <Label>Key Movements</Label>
            <ul
              style={{
                margin: 0,
                paddingLeft: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
              }}
            >
              {(analysis.keyMovements ?? []).map((movement, i) => (
                <li key={i} style={{ fontSize: "13px", color: "#475569", lineHeight: "1.55" }}>
                  {movement}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Items for Attention ── */}
        {(analysis.itemsForAttention ?? []).length > 0 && (
          <div>
            <Label>Items for Attention</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(analysis.itemsForAttention ?? []).map((item, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: "rgba(217,119,6,0.06)",
                    border: "1px solid rgba(217,119,6,0.25)",
                    borderRadius: "8px",
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#92400e",
                      marginBottom: "4px",
                    }}
                  >
                    {item.heading}
                  </div>
                  <div style={{ fontSize: "12px", color: "#78350f", lineHeight: "1.55" }}>
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Key Events ── */}
        {(analysis.keyEvents ?? []).length > 0 && (
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
              {(analysis.keyEvents ?? []).map((event, i) => (
                <li key={i} style={{ fontSize: "13px", color: "#475569", lineHeight: "1.55" }}>
                  {event}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Management Commentary ── */}
        {analysis.managementCommentary && (
          <div>
            <Label>Management Commentary</Label>
            <div
              style={{
                borderLeft: "3px solid #4f46e5",
                backgroundColor: "rgba(79,70,229,0.04)",
                borderRadius: "0 8px 8px 0",
                padding: "12px 14px",
                fontSize: "13px",
                color: "#334155",
                lineHeight: "1.65",
                fontStyle: "italic",
              }}
            >
              {analysis.managementCommentary}
            </div>
          </div>
        )}

        {/* ── Audit Opinion ── */}
        {audit && (
          <div>
            <Label>Audit Opinion</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <AuditBadge opinion={audit.opinion} />
                {audit.auditorChanged === true && (
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
              {audit.auditorName && (
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  Audited by{" "}
                  <span style={{ fontWeight: "600", color: "#0f172a" }}>{audit.auditorName}</span>
                </div>
              )}
              {audit.emphasisOfMatter && (
                <div
                  style={{
                    backgroundColor: "rgba(217,119,6,0.07)",
                    border: "1px solid rgba(217,119,6,0.25)",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    marginTop: "2px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: "700",
                      color: "#d97706",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}
                  >
                    Emphasis of Matter
                  </div>
                  <div style={{ fontSize: "12px", color: "#78350f", lineHeight: "1.55" }}>
                    {audit.emphasisOfMatter}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Going Concern ── */}
        {gc?.flagged && (
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
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#92400e",
                    marginBottom: "4px",
                  }}
                >
                  Going Concern Note
                </div>
                <div style={{ fontSize: "12px", color: "#78350f", lineHeight: "1.55" }}>
                  {gc.detail ||
                    "The accounts include a going concern note or material uncertainty disclosure."}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Director Loans ── */}
        {dl?.present && dl.detail && (
          <div>
            <Label>Director Loans</Label>
            <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>{dl.detail}</div>
          </div>
        )}

        {/* ── Related Party Transactions ── */}
        {rpt?.present && rpt.detail && (
          <div>
            <Label>Related Party Transactions</Label>
            <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>{rpt.detail}</div>
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
