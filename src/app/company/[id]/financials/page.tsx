"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { AccountsAnalysis } from "@/lib/analysis-types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayString(value: string | undefined | null): string {
  if (value == null) return "—";
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "n/a") return "—";
  return trimmed;
}

function yoyHighlight(yoy: string | undefined): "positive" | "negative" | "neutral" {
  if (!yoy) return "neutral";
  const t = yoy.trim();
  if (t.startsWith("+")) return "positive";
  if (t.startsWith("-") || t.startsWith("−")) return "negative";
  return "neutral";
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

function RevenueCallout({ revenue, yoy }: { revenue: string; yoy: string }) {
  const highlight = yoyHighlight(yoy);
  const yoyColor =
    highlight === "positive" ? "#059669" : highlight === "negative" ? "#dc2626" : "#64748b";
  const display = displayString(revenue);
  if (display === "—") {
    return (
      <div
        style={{ padding: "32px 18px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}
      >
        Revenue data not available
      </div>
    );
  }
  return (
    <div
      style={{
        padding: "24px 18px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <span style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a" }}>{display}</span>
      <span style={{ fontSize: "12px", fontWeight: "600", color: yoyColor }}>
        {displayString(yoy)} year-on-year
      </span>
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

  const fh = analysis?.financialHealth;
  const margins = analysis?.margins;

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
          <span style={{ color: "#0f172a" }}>Docu</span>
          <span style={{ color: "#4f46e5" }}>Data</span>
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
                value={displayString(fh?.revenue.value)}
                highlight={yoyHighlight(fh?.revenue.yoyChange)}
              />
              <MetricRow
                label="Gross Profit"
                value={displayString(fh?.grossProfit.value)}
                highlight={yoyHighlight(fh?.grossProfit.yoyChange)}
              />
              <MetricRow
                label="Operating Profit"
                value={displayString(fh?.operatingProfit.value)}
                highlight={yoyHighlight(fh?.operatingProfit.yoyChange)}
              />
              <MetricRow
                label="Net Profit / (Loss)"
                value={displayString(fh?.netProfit.value)}
                highlight={yoyHighlight(fh?.netProfit.yoyChange)}
              />
              <MetricRow
                label="Net Assets (Equity)"
                value={displayString(fh?.netAssets)}
                highlight="neutral"
              />
              <MetricRow
                label="Cash Position"
                value={displayString(fh?.cashPosition)}
                isLast
                highlight="neutral"
              />
            </div>

            {/* Calculated ratios */}
            <div style={CARD}>
              <SectionHeader title="Margins" />
              <MetricRow
                label="Gross Margin"
                value={displayString(margins?.grossMargin)}
                highlight="neutral"
              />
              <MetricRow
                label="Operating Margin"
                value={displayString(margins?.operatingMargin)}
                isLast
                highlight="neutral"
              />
            </div>

            {/* Revenue callout */}
            <div style={CARD}>
              <SectionHeader title="Revenue" />
              <RevenueCallout
                revenue={fh?.revenue.value ?? ""}
                yoy={fh?.revenue.yoyChange ?? ""}
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
