"use client";

import { useState } from "react";

// ── Tab definitions ───────────────────────────────────────────────────────────

export type TabId =
  | "overview"
  | "financials"
  | "ai-analysis"
  | "directors"
  | "filings"
  | "charges"
  | "ownership"
  | "director-network"
  | "news";

export const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "financials", label: "Financials" },
  { id: "ai-analysis", label: "AI analysis" },
  { id: "directors", label: "Directors" },
  { id: "filings", label: "Filings" },
  { id: "charges", label: "Charges" },
  { id: "ownership", label: "Ownership" },
  { id: "director-network", label: "Director network" },
  { id: "news", label: "News" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Controlled initial tab — defaults to "overview" */
  activeTab?: TabId;
  /** Called whenever the user switches tabs */
  onTabChange?: (tab: TabId) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CompanyTabs({ activeTab: initialTab = "overview", onTabChange }: Props) {
  const [active, setActive] = useState<TabId>(initialTab);

  function handleSelect(tab: TabId) {
    setActive(tab);
    onTabChange?.(tab);
  }

  return (
    <div
      style={{
        borderBottom: "1px solid #e2e8f0",
        backgroundColor: "#ffffff",
        overflowX: "auto",
        /* Prevent scrollbar from jumping layout */
        scrollbarWidth: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "0",
          minWidth: "max-content",
          paddingLeft: "2px",
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelect(tab.id)}
              style={{
                position: "relative",
                padding: "14px 18px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: isActive ? "600" : "400",
                color: isActive ? "#4f46e5" : "#475569",
                whiteSpace: "nowrap",
                transition: "color 0.12s",
                /* Active indicator — sits on top of the container's bottom border */
                borderBottom: isActive ? "2px solid #4f46e5" : "2px solid transparent",
                marginBottom: "-1px",
                outline: "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLButtonElement).style.color = "#0f172a";
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLButtonElement).style.color = "#475569";
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
