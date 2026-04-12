"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { AccountsAnalysis, AnalysisRisk } from "@/lib/analysis-types";

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

function AuditBadge({
  opinion,
}: {
  opinion: AccountsAnalysis["auditOpinion"];
}) {
  const cfg: Record<
    string,
    { label: string; color: string; bg: string; icon: string }
  > = {
    clean: {
      label: "Clean Opinion",
      color: "#059669",
      bg: "rgba(5,150,105,0.09)",
      icon: "✓",
    },
    qualified: {
      label: "Qualified Opinion",
      color: "#d97706",
      bg: "rgba(217,119,6,0.09)",
      icon: "⚠",
    },
    adverse: {
      label: "Adverse Opinion",
      color: "#dc2626",
      bg: "rgba(220,38,38,0.09)",
      icon: "✗",
    },
    disclaimer: {
      label: "Disclaimer of Opinion",
      color: "#dc2626",
      bg: "rgba(220,38,38,0.09)",
      icon: "✗",
    },
    unknown: {
      label: "Opinion Unknown",
      color: "#94a3b8",
      bg: "rgba(148,163,184,0.09)",
      icon: "?",
    },
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
          <div
            style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}
          >
            AI Document Intelligence
          </div>
          <div
            style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}
          >
            Extracted from filed accounts
          </div>
        </div>
      </div>
      {badge}
    </div>
  );
}

function Pill({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
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
          setErrorMsg(
            (data as { error?: string }).error ?? `HTTP ${res.status}`
          );
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
        <CardHeader
          badge={
            <Pill
              label="Analysing…"
              color="#4f46e5"
              bg="rgba(79,70,229,0.08)"
            />
          }
        />
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
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#0f172a",
                marginBottom: "6px",
              }}
            >
              Analysing filed accounts
            </div>
            <div
              style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.6" }}
            >
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
        <CardHeader
          badge={
            <Pill label="Not available" color="#94a3b8" bg="#f1f5f9" />
          }
        />
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
        <CardHeader
          badge={
            <Pill
              label="Error"
              color="#dc2626"
              bg="rgba(220,38,38,0.08)"
            />
          }
        />
        <div style={{ padding: "18px" }}>
          <div
            style={{
              borderLeft: "3px solid #dc2626",
              backgroundColor: "rgba(220,38,38,0.05)",
              borderRadius: "0 8px 8px 0",
              padding: "12px 16px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#0f172a",
                marginBottom: "4px",
              }}
            >
              Analysis failed
            </div>
            <div style={{ fontSize: "12px", color: "#475569" }}>
              {errorMsg || "An unexpected error occurred. Please try refreshing."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (!analysis) return null;

  const highRisks = analysis.risks.filter((r) => r.severity === "high").length;
  const badgeLabel =
    highRisks > 0
      ? `${highRisks} high risk${highRisks > 1 ? "s" : ""}`
      : "Analysis complete";
  const badgeColor = highRisks > 0 ? "#dc2626" : "#059669";
  const badgeBg =
    highRisks > 0 ? "rgba(220,38,38,0.08)" : "rgba(5,150,105,0.08)";

  return (
    <div style={CARD}>
      <CardHeader
        badge={
          <Pill label={`✓ ${badgeLabel}`} color={badgeColor} bg={badgeBg} />
        }
      />

      <div
        style={{
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Going concern warning */}
        {analysis.goingConcern && (
          <div
            style={{
              display: "flex",
              gap: "10px",
              backgroundColor: "rgba(217,119,6,0.07)",
              border: "1px solid rgba(217,119,6,0.30)",
              borderRadius: "8px",
              padding: "12px 14px",
            }}
          >
            <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#92400e",
                  marginBottom: "3px",
                }}
              >
                Going Concern Note Identified
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#78350f",
                  lineHeight: "1.55",
                }}
              >
                Auditors have flagged material uncertainty about this
                company&apos;s ability to continue as a going concern.
              </div>
            </div>
          </div>
        )}

        {/* Audit opinion */}
        <div>
          <Label>Audit Opinion</Label>
          <AuditBadge opinion={analysis.auditOpinion} />
        </div>

        {/* Summary */}
        {analysis.summary && (
          <div>
            <Label>Summary</Label>
            <p
              style={{
                fontSize: "13px",
                color: "#475569",
                lineHeight: "1.65",
                margin: 0,
              }}
            >
              {analysis.summary}
            </p>
          </div>
        )}

        {/* Risks */}
        {analysis.risks.length > 0 && (
          <div>
            <Label>Risks Identified ({analysis.risks.length})</Label>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              {analysis.risks.map((risk, i) => {
                const borderColor =
                  risk.severity === "high"
                    ? "#dc2626"
                    : risk.severity === "medium"
                    ? "#d97706"
                    : "#4f46e5";
                const bgColor =
                  risk.severity === "high"
                    ? "rgba(220,38,38,0.05)"
                    : risk.severity === "medium"
                    ? "rgba(217,119,6,0.05)"
                    : "rgba(79,70,229,0.05)";
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "5px",
                      }}
                    >
                      <SeverityBadge severity={risk.severity} />
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#0f172a",
                        }}
                      >
                        {risk.title}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#475569",
                        lineHeight: "1.55",
                      }}
                    >
                      {risk.detail}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Key events */}
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
                <li
                  key={i}
                  style={{
                    fontSize: "13px",
                    color: "#475569",
                    lineHeight: "1.55",
                  }}
                >
                  {event}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #f1f5f9",
            paddingTop: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            {analysis.documentDate && (
              <>
                Accounts filed{" "}
                {new Date(analysis.documentDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </>
            )}
            {analysis.cached && " · cached"}
          </span>

          <Link
            href={`/company/${companyNumber}/financials`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "7px 14px",
              backgroundColor: "#4f46e5",
              color: "#ffffff",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "600",
              flexShrink: 0,
            }}
          >
            View Full Financials →
          </Link>
        </div>
      </div>
    </div>
  );
}
