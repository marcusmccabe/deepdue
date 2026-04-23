"use client";

import { useState, useEffect } from "react";
import type { FinancialSnapshot, FinancialYear } from "@/lib/financial-snapshot-types";

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  const abs = Math.abs(value);
  const prefix = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${prefix}£${(abs / 1_000_000_000).toFixed(1)}bn`;
  if (abs >= 1_000_000) return `${prefix}£${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${prefix}£${Math.round(abs / 1_000)}k`;
  return `${prefix}£${Math.round(abs).toLocaleString("en-GB")}`;
}

function formatPeriodEnd(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function yoyChange(
  current: number | null,
  prior: number | null
): { label: string; positive: boolean } | null {
  if (current === null || prior === null || prior === 0) return null;
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  const positive = pct >= 0;
  const label = `${positive ? "+" : ""}${pct.toFixed(1)}%`;
  return { label, positive };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
  overflow: "hidden",
};

function SkeletonBlock({ w, h }: { w: string; h: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        backgroundColor: "#f1f5f9",
        borderRadius: "4px",
        display: "inline-block",
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div style={CARD}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "15px 18px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <SkeletonBlock w="160px" h="14px" />
        <SkeletonBlock w="80px" h="12px" />
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr 1fr 1fr",
            alignItems: "center",
            padding: "14px 18px",
            borderBottom: i < 4 ? "1px solid #f1f5f9" : "none",
            gap: "16px",
          }}
        >
          <SkeletonBlock w="120px" h="12px" />
          <SkeletonBlock w="72px" h="18px" />
          <SkeletonBlock w="72px" h="18px" />
          <SkeletonBlock w="72px" h="18px" />
        </div>
      ))}
    </div>
  );
}

function NoDataCard({ companyNumber }: { companyNumber: string }) {
  return (
    <div style={CARD}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "15px 18px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
          Financial Snapshot
        </span>
        <span
          style={{
            fontSize: "10px",
            fontWeight: "600",
            color: "#94a3b8",
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            padding: "2px 8px",
            borderRadius: "100px",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          iXBRL · No data
        </span>
      </div>
      <div style={{ padding: "28px 18px" }}>
        <div
          style={{
            borderLeft: "3px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            borderRadius: "0 8px 8px 0",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#0f172a",
              marginBottom: "6px",
            }}
          >
            Structured data not available for this company
          </div>
          <div
            style={{ fontSize: "12px", color: "#475569", lineHeight: "1.7" }}
          >
            Instant figures are sourced from iXBRL-tagged annual accounts.
            This company&apos;s filed accounts may be PDF-only (common for
            micro-entities and older filings), or no full accounts (AA) have
            been filed yet.
          </div>
          <div style={{ marginTop: "12px", fontSize: "12px", color: "#475569" }}>
            For AI-extracted financial figures, use the{" "}
            <a
              href={`/company/${companyNumber.toLowerCase()}/financials`}
              style={{
                color: "#4f46e5",
                fontWeight: "600",
                textDecoration: "none",
              }}
            >
              AI Analysis →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Metric row in the multi-year table
function MetricRow({
  label,
  years,
  getValue,
  isLast = false,
}: {
  label: string;
  years: FinancialYear[];
  getValue: (y: FinancialYear) => number | null;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `180px repeat(${Math.max(years.length, 1)}, 1fr)`,
        alignItems: "start",
        padding: "14px 18px",
        borderBottom: isLast ? "none" : "1px solid #f1f5f9",
        gap: "8px",
      }}
    >
      {/* Metric label */}
      <span
        style={{
          fontSize: "13px",
          color: "#475569",
          paddingTop: "2px",
          fontWeight: "500",
        }}
      >
        {label}
      </span>

      {/* Value per year */}
      {years.map((yr, i) => {
        const current = getValue(yr);
        const prior = i + 1 < years.length ? getValue(years[i + 1]) : null;
        const change = yoyChange(current, prior);
        const isNegative = current !== null && current < 0;

        return (
          <div key={yr.periodEnd} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <span
              style={{
                fontSize: "15px",
                fontWeight: "700",
                color: isNegative ? "#dc2626" : "#0f172a",
              }}
            >
              {formatCurrency(current)}
            </span>
            {change && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: change.positive ? "#059669" : "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                {change.positive ? "▲" : "▼"} {change.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FinancialSnapshotPanel({
  companyNumber,
}: {
  companyNumber: string;
}) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/financial-snapshot?companyNumber=${encodeURIComponent(companyNumber)}`
        );
        if (cancelled) return;

        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setErrorMsg(
            (d as { error?: string }).error ?? `HTTP ${res.status}`
          );
          setStatus("error");
          return;
        }

        const data: FinancialSnapshot = await res.json();
        setSnapshot(data);
        setStatus("success");
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(String(err));
          setStatus("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyNumber]);

  if (status === "loading") return <LoadingSkeleton />;

  if (status === "error") {
    return (
      <div style={CARD}>
        <div
          style={{
            padding: "15px 18px",
            borderBottom: "1px solid #e2e8f0",
            fontSize: "13px",
            fontWeight: "700",
            color: "#0f172a",
          }}
        >
          Financial Snapshot
        </div>
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
              Failed to load structured data
            </div>
            <div style={{ fontSize: "12px", color: "#475569" }}>
              {errorMsg || "An unexpected error occurred."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!snapshot || snapshot.source === "none" || snapshot.years.length === 0) {
    return <NoDataCard companyNumber={companyNumber} />;
  }

  // Filter to years that have at least one figure
  const dataYears = snapshot.years.filter((y) => y.hasData);
  if (dataYears.length === 0) {
    return <NoDataCard companyNumber={companyNumber} />;
  }

  const colCount = dataYears.length;
  const sourceLabel = snapshot.cached ? "iXBRL · cached" : "iXBRL";

  return (
    <div style={CARD}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "15px 18px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div>
          <span
            style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}
          >
            Financial Snapshot
          </span>
          <span
            style={{
              marginLeft: "10px",
              fontSize: "11px",
              color: "#94a3b8",
            }}
          >
            Sourced from iXBRL-tagged annual accounts
          </span>
        </div>
        <span
          style={{
            fontSize: "10px",
            fontWeight: "600",
            color: "#4f46e5",
            backgroundColor: "rgba(79,70,229,0.08)",
            border: "1px solid rgba(79,70,229,0.20)",
            padding: "2px 8px",
            borderRadius: "100px",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {sourceLabel}
        </span>
      </div>

      {/* Year header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `180px repeat(${colCount}, 1fr)`,
          padding: "10px 18px 6px",
          backgroundColor: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          gap: "8px",
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
        {dataYears.map((yr, i) => (
          <div key={yr.periodEnd}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: i === 0 ? "#0f172a" : "#64748b",
              }}
            >
              FY {yr.year}
              {i === 0 && (
                <span
                  style={{
                    marginLeft: "6px",
                    fontSize: "9px",
                    fontWeight: "600",
                    color: "#4f46e5",
                    backgroundColor: "rgba(79,70,229,0.08)",
                    padding: "1px 5px",
                    borderRadius: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Latest
                </span>
              )}
            </div>
            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "1px" }}>
              {formatPeriodEnd(yr.periodEnd)}
            </div>
          </div>
        ))}
      </div>

      {/* Metric rows */}
      <MetricRow
        label="Turnover / Revenue"
        years={dataYears}
        getValue={(y) => y.turnover}
      />
      <MetricRow
        label="Operating Profit"
        years={dataYears}
        getValue={(y) => y.operatingProfit}
      />
      <MetricRow
        label="Net Assets"
        years={dataYears}
        getValue={(y) => y.netAssets}
      />
      <MetricRow
        label="Cash at Bank"
        years={dataYears}
        getValue={(y) => y.cashAtBank}
      />
      <MetricRow
        label="Total Liabilities"
        years={dataYears}
        getValue={(y) => y.totalLiabilities}
        isLast
      />

      {/* Footer */}
      <div
        style={{
          padding: "10px 18px",
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
          {colCount === 1
            ? "1 year of data — full historical trend available from AI analysis"
            : `${colCount} years of data from filed accounts`}
        </span>
        <span style={{ fontSize: "11px", color: "#cbd5e1" }}>
          Updated{" "}
          {new Date(snapshot.fetchedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}
