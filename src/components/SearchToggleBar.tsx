"use client";

import { useState } from "react";

export default function SearchToggleBar() {
  const [mode, setMode] = useState<"Company" | "Director">("Company");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "8px",
      }}
    >
      {/* Toggle pills */}
      <div
        style={{
          display: "flex",
          backgroundColor: "#f1f5f9",
          borderRadius: "100px",
          padding: "2px",
        }}
      >
        {(["Company", "Director"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMode(tab)}
            style={{
              padding: "4px 12px",
              borderRadius: "100px",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: mode === tab ? "600" : "400",
              backgroundColor: mode === tab ? "#ffffff" : "transparent",
              color: mode === tab ? "#0f172a" : "#94a3b8",
              boxShadow: mode === tab ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          width: "260px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 15 15"
          fill="none"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.309 10.016C8.535 10.632 7.558 11 6.5 11C4.015 11 2 8.985 2 6.5C2 4.015 4.015 2 6.5 2C8.985 2 11 4.015 11 6.5C11 7.558 10.632 8.535 10.016 9.309L12.854 12.146C13.049 12.342 13.049 12.658 12.854 12.854C12.658 13.049 12.342 13.049 12.146 12.854L9.309 10.016Z"
            fill="#94a3b8"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="text"
          placeholder={
            mode === "Company" ? "Search company…" : "Search director…"
          }
          style={{
            border: "none",
            outline: "none",
            fontSize: "13px",
            color: "#0f172a",
            flex: 1,
            backgroundColor: "transparent",
          }}
        />
      </div>
    </div>
  );
}
