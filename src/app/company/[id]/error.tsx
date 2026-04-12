"use client";

import Link from "next/link";

export default function CompanyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        textAlign: "center",
      }}
    >
      {/* Logo */}
      <div
        style={{
          fontFamily: 'var(--font-instrument-serif), "Instrument Serif", serif',
          fontSize: "22px",
          marginBottom: "40px",
        }}
      >
        <span style={{ color: "#0f172a" }}>Deep</span>
        <span style={{ color: "#4f46e5" }}>Due</span>
        <span style={{ color: "#94a3b8", fontSize: "15px" }}>.ai</span>
      </div>

      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "40px 48px",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "16px" }}>⚠️</div>

        <h1
          style={{
            fontFamily: 'var(--font-instrument-serif), "Instrument Serif", serif',
            fontSize: "24px",
            fontWeight: "400",
            color: "#0f172a",
            marginBottom: "12px",
          }}
        >
          Could not load company profile
        </h1>

        <p
          style={{
            fontSize: "14px",
            color: "#475569",
            lineHeight: "1.7",
            marginBottom: "28px",
          }}
        >
          There was a problem fetching data from Companies House. This may be a
          temporary issue — please try again or go back to search for a different
          company.
        </p>

        {error.digest && (
          <p
            style={{
              fontSize: "11px",
              color: "#94a3b8",
              marginBottom: "24px",
              fontFamily: "'Courier New', monospace",
            }}
          >
            Error ref: {error.digest}
          </p>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              padding: "9px 18px",
              backgroundColor: "#4f46e5",
              color: "#ffffff",
              border: "none",
              borderRadius: "7px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            style={{
              padding: "9px 18px",
              backgroundColor: "transparent",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: "7px",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
