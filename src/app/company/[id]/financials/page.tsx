"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { AccountsAnalysis, FinancialSnapshot } from "@/lib/analysis-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number | null | undefined, currency = "GBP"): string {
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

function pct(numerator: number | null | undefined, denominator: number | null | undefined): string {
  if (numerator == null || denominator == null || denominator === 0) return "—";
  return ((numerator / denominator) * 100).toFixed(1) + "%";
}

// ── Sub-components ────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
  overflow: "hidden",
};

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ padding: "15px 18px", borderBottom: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>{subtitle}</div>
      )}
    </div>
  );
}

function TableHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 140px",
        padding: "8px 18px",
        backgroundColor: "#f8fafc",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          fontWeight: "700",
          color: "#94a3b8",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Metric
      </span>
      <span
        style={{
          fontSize: "10px",
          fontWeight: "700",
          color: "#0f172a",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textAlign: "right",
        }}
      >
        Value
      </span>
    </div>
  );
}

function MetricRow({
  label,
  value,
  isLast,
  highlight,
}: {
  label: string;
  value: string;
  isLast?: boolean;
  highlight?: "positive" | "negative" | "neutral";
}) {
  const valueColor =
    highlight === "positive" ? "#059669" : highlight === "negative" ? "#dc2626" : "#0f172a";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 140px",
        alignItems: "center",
        padding: "13px 18px",
        borderBottom: isLast ? "none" : "1px solid #f1f5f9",
      }}
    >
      <span style={{ fontSize: "13px", color: "#475569" }}>{label}</span>
      <span
        style={{ fontSize: "13px", fontWeight: "600", color: valueColor, textAlign: "right" }}
      >
        {value}
      </span>
    </div>
  );
}

function BarChart({ revenue, currency }: { revenue: number | null; currency: string }) {
  if (!revenue) {
    return (
      <div
        style={{ padding: "32px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}
      >
        Revenue data not available for chart
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px 18px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: "20px", height: "140px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", fontWeight: "600", color: "#4f46e5" }}>
            {fmt(revenue, currency)}
          </span>
          <div
            style={{
              width: "64px",
              height: "120px",
              backgroundColor: "#4f46e5",
              borderRadius: "4px 4px 0 0",
              opacity: 0.85,
            }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "2px",
              backgroundColor: "#4f46e5",
              opacity: 0.85,
            }}
          />
          <span style={{ fontSize: "11px", color: "#475569" }}>Current year</span>
        </div>
      </div>
      <p style={{ fontSize: "11px", color: "#cbd5e1", margin: "4px 0 0", textAlign: "center" }}>
        Multi-year trend available when multiple accounts are analysed
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        padding: "60px 18px",
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
          style={{ fontSize: "14px", fontWeight: "600", color: "#0f172a", marginBottom: "6px" }}
        >
          Loading financial data
        </div>
        <div style={{ fontSize: "12px", color: "#94a3b8" }}>
          Analysing filed accounts — this may take up to 30 seconds
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FinancialsPage() {
  const params = useParams();
  const companyNumber = (params.id as string).toUpperCase();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
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

  const snap: FinancialSnapshot | undefined = analysis?.financialSnapshot;
  const currency = "GBP";

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
      }}
    >
      {/* ── Nav ── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          zIndex: 50,
          padding: "0 32px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <Link
          href={`/company/${companyNumber.toLowerCase()}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "#475569",
            fontSize: "13px",
            fontWeight: "500",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <path
              d="M8.842 3.135a.5.5 0 0 1 .023.707L5.435 7.5l3.43 3.658a.5.5 0 0 1-.73.684l-3.75-4a.5.5 0 0 1 0-.684l3.75-4a.5.5 0 0 1 .707-.023Z"
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </svg>
          Company Profile
        </Link>
        <span style={{ color: "#e2e8f0" }}>›</span>
        <span style={{ fontSize: "13px", color: "#0f172a", fontWeight: "600" }}>
          Financial Analysis
        </span>
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontFamily: 'var(--font-instrument-serif), "Instrument Serif", serif',
            fontSize: "18px",
          }}
        >
          <span style={{ color: "#0f172a" }}>Deep</span>
          <span style={{ color: "#4f46e5" }}>Due</span>
          <span style={{ color: "#94a3b8", fontSize: "13px" }}>.ai</span>
        </div>
      </nav>

      {/* ── Content ── */}
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 32px 64px" }}>
        {/* Page title */}
        <div style={{ marginBottom: "24px" }}>
          <h1
            style={{
              fontFamily: 'var(--font-instrument-serif), "Instrument Serif", serif',
              fontSize: "30px",
              fontWeight: "400",
              color: "#0f172a",
              margin: "0 0 6px",
            }}
          >
            Financial Analysis
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            Figures extracted by AI from the most recent filed accounts ·{" "}
            <span style={{ fontFamily: "'Courier New', monospace", fontWeight: "600" }}>
              {companyNumber}
            </span>
          </p>
        </div>

        {/* ── Loading ── */}
        {status === "loading" && (
          <div style={CARD}>
            <LoadingState />
          </div>
        )}

        {/* ── Error ── */}
        {status === "error" && (
          <div style={CARD}>
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
                  Failed to load financial data
                </div>
                <div style={{ fontSize: "12px", color: "#475569" }}>
                  {errorMsg || "An unexpected error occurred."}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Success ── */}
        {status === "success" && analysis && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Key figures */}
            <div style={CARD}>
              <SectionHeader title="Key Financial Figures" />
              <TableHeader />
              <MetricRow
                label="Revenue (Turnover)"
                value={fmt(snap?.revenue, currency)}
                highlight={
                  snap?.revenue != null && snap.revenue > 0 ? "positive" : "neutral"
                }
              />
              <MetricRow
                label="Gross Profit"
                value={fmt(snap?.grossProfit, currency)}
                highlight={
                  snap?.grossProfit == null ? "neutral"
                  : snap.grossProfit >= 0 ? "positive" : "negative"
                }
              />
              <MetricRow
                label="Operating Profit"
                value={fmt(snap?.operatingProfit, currency)}
                highlight={
                  snap?.operatingProfit == null ? "neutral"
                  : snap.operatingProfit >= 0 ? "positive" : "negative"
                }
              />
              <MetricRow
                label="Net Profit / (Loss)"
                value={fmt(snap?.netProfit, currency)}
                highlight={
                  snap?.netProfit == null ? "neutral"
                  : snap.netProfit >= 0 ? "positive" : "negative"
                }
              />
              <MetricRow
                label="Net Assets (Equity)"
                value={fmt(snap?.netAssets, currency)}
                highlight={
                  snap?.netAssets == null ? "neutral"
                  : snap.netAssets >= 0 ? "positive" : "negative"
                }
              />
              <MetricRow
                label="Cash &amp; Equivalents"
                value={fmt(snap?.cash, currency)}
                highlight={snap?.cash != null && snap.cash > 0 ? "positive" : "neutral"}
              />
              <MetricRow
                label="Total Debt"
                value={fmt(snap?.totalDebt, currency)}
                highlight={snap?.totalDebt != null && snap.totalDebt > 0 ? "negative" : "neutral"}
              />
              <MetricRow
                label="Employees"
                value={
                  snap?.employeeCount != null
                    ? snap.employeeCount.toLocaleString("en-GB")
                    : "—"
                }
                isLast
              />
            </div>

            {/* Calculated ratios */}
            <div style={CARD}>
              <SectionHeader title="Calculated Ratios" />
              <MetricRow
                label="Gross Margin"
                value={pct(snap?.grossProfit, snap?.revenue)}
                highlight={
                  snap?.grossProfit != null && snap?.revenue
                    ? snap.grossProfit / snap.revenue >= 0 ? "positive" : "negative"
                    : "neutral"
                }
              />
              <MetricRow
                label="Operating Margin"
                value={pct(snap?.operatingProfit, snap?.revenue)}
                highlight={
                  snap?.operatingProfit != null && snap?.revenue
                    ? snap.operatingProfit / snap.revenue >= 0 ? "positive" : "negative"
                    : "neutral"
                }
              />
              <MetricRow
                label="Net Margin"
                value={pct(snap?.netProfit, snap?.revenue)}
                isLast
                highlight={
                  snap?.netProfit != null && snap?.revenue
                    ? snap.netProfit / snap.revenue >= 0 ? "positive" : "negative"
                    : "neutral"
                }
              />
            </div>

            {/* Revenue chart */}
            <div style={CARD}>
              <SectionHeader title="Revenue" />
              <BarChart revenue={snap?.revenue ?? null} currency={currency} />
            </div>

            {/* Document metadata footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11px",
                color: "#94a3b8",
                padding: "0 2px",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <span>
                {analysis.documentDate &&
                  `Accounts filed ${new Date(analysis.documentDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}`}
                {analysis.cached && " · cached result"}
              </span>
              <span>Analysed {new Date(analysis.analysedAt).toLocaleString("en-GB")}</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
