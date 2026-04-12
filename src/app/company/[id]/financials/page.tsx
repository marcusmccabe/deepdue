"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { AccountsAnalysis } from "@/lib/analysis-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(
  value: number | null | undefined,
  currency = "GBP"
): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
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
  const symbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";
  return `${symbol}${formatted}`;
}

function ratio(numerator: number | null, denominator: number | null): string {
  if (!numerator || !denominator || denominator === 0) return "—";
  return ((numerator / denominator) * 100).toFixed(1) + "%";
}

function netMargin(analysis: AccountsAnalysis): string {
  const { profit, revenue } = analysis.financials;
  return ratio(profit, revenue);
}

function gearing(analysis: AccountsAnalysis): string {
  const { liabilities, assets } = analysis.financials;
  if (!liabilities || !assets || assets === 0) return "—";
  const equity = assets - liabilities;
  if (equity <= 0) return "N/A";
  return ((liabilities / equity) * 100).toFixed(1) + "%";
}

// ── Sub-components ────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
  overflow: "hidden",
};

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        padding: "15px 18px",
        borderBottom: "1px solid #e2e8f0",
        fontSize: "13px",
        fontWeight: "700",
        color: "#0f172a",
      }}
    >
      {title}
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
    highlight === "positive"
      ? "#059669"
      : highlight === "negative"
      ? "#dc2626"
      : "#0f172a";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "13px 18px",
        borderBottom: isLast ? "none" : "1px solid #f1f5f9",
      }}
    >
      <span style={{ fontSize: "13px", color: "#475569" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: "600", color: valueColor }}>
        {value}
      </span>
    </div>
  );
}

function BarChart({
  revenue,
  currency,
}: {
  revenue: number | null;
  currency: string;
}) {
  if (!revenue) {
    return (
      <div
        style={{
          padding: "32px 18px",
          textAlign: "center",
          color: "#94a3b8",
          fontSize: "13px",
        }}
      >
        Revenue data not available for chart
      </div>
    );
  }

  // Single year bar — future sessions can extend this to multi-year
  const BAR_HEIGHT = 140;
  const BAR_WIDTH = 72;

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
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "16px",
          height: `${BAR_HEIGHT}px`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
          <span
            style={{ fontSize: "11px", fontWeight: "600", color: "#4f46e5" }}
          >
            {fmt(revenue, currency)}
          </span>
          <div
            style={{
              width: `${BAR_WIDTH}px`,
              height: `${BAR_HEIGHT - 20}px`,
              backgroundColor: "#4f46e5",
              borderRadius: "5px 5px 0 0",
              opacity: 0.85,
            }}
          />
        </div>
      </div>
      <div
        style={{
          width: `${BAR_WIDTH}px`,
          height: "2px",
          backgroundColor: "#e2e8f0",
        }}
      />
      <span style={{ fontSize: "11px", color: "#94a3b8" }}>Most recent accounts</span>
      <p style={{ fontSize: "11px", color: "#cbd5e1", margin: 0, textAlign: "center" }}>
        Multi-year trend available when multiple accounts are analysed
      </p>
    </div>
  );
}

// ── Loading / error states ────────────────────────────────────────────────────

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
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#0f172a",
            marginBottom: "6px",
          }}
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

  const currency = analysis?.financials?.currency ?? "GBP";

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
      <main
        style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 32px 64px" }}
      >
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
              <MetricRow
                label="Revenue (Turnover)"
                value={fmt(analysis.financials.revenue, currency)}
                highlight={
                  analysis.financials.revenue && analysis.financials.revenue > 0
                    ? "positive"
                    : "neutral"
                }
              />
              <MetricRow
                label="Profit / (Loss)"
                value={fmt(analysis.financials.profit, currency)}
                highlight={
                  analysis.financials.profit === null
                    ? "neutral"
                    : analysis.financials.profit >= 0
                    ? "positive"
                    : "negative"
                }
              />
              <MetricRow
                label="Total Assets"
                value={fmt(analysis.financials.assets, currency)}
              />
              <MetricRow
                label="Total Liabilities"
                value={fmt(analysis.financials.liabilities, currency)}
                highlight={
                  analysis.financials.liabilities && analysis.financials.assets &&
                  analysis.financials.liabilities > analysis.financials.assets
                    ? "negative"
                    : "neutral"
                }
              />
              <MetricRow
                label="Employees"
                value={
                  analysis.financials.employees !== null
                    ? analysis.financials.employees.toLocaleString("en-GB")
                    : "—"
                }
                isLast
              />
            </div>

            {/* Calculated ratios */}
            <div style={CARD}>
              <SectionHeader title="Calculated Ratios" />
              <MetricRow
                label="Net Margin"
                value={netMargin(analysis)}
                highlight={
                  analysis.financials.profit !== null && analysis.financials.revenue
                    ? analysis.financials.profit / analysis.financials.revenue >= 0
                      ? "positive"
                      : "negative"
                    : "neutral"
                }
              />
              <MetricRow
                label="Gearing (Liabilities / Equity)"
                value={gearing(analysis)}
                highlight={
                  analysis.financials.liabilities && analysis.financials.assets
                    ? analysis.financials.liabilities /
                        (analysis.financials.assets - analysis.financials.liabilities) >
                      2
                      ? "negative"
                      : "neutral"
                    : "neutral"
                }
              />
              <MetricRow
                label="Net Assets (Equity)"
                value={
                  analysis.financials.assets !== null &&
                  analysis.financials.liabilities !== null
                    ? fmt(
                        analysis.financials.assets - analysis.financials.liabilities,
                        currency
                      )
                    : "—"
                }
                isLast
                highlight={
                  analysis.financials.assets !== null &&
                  analysis.financials.liabilities !== null
                    ? analysis.financials.assets - analysis.financials.liabilities >= 0
                      ? "positive"
                      : "negative"
                    : "neutral"
                }
              />
            </div>

            {/* Revenue chart */}
            <div style={CARD}>
              <SectionHeader title="Revenue" />
              <BarChart
                revenue={analysis.financials.revenue}
                currency={currency}
              />
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
                  `Accounts filed ${new Date(analysis.documentDate).toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "short", year: "numeric" }
                  )}`}
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
