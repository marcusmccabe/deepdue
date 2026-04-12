import Link from "next/link";

export default function LandingPage() {
  return (
    <div
      style={{
        backgroundColor: "#f8fafc",
        minHeight: "100vh",
        fontFamily:
          'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
      }}
    >
      {/* ── Sticky Navbar ── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "64px",
          }}
        >
          {/* Logo */}
          <div
            style={{
              fontFamily:
                'var(--font-instrument-serif), "Instrument Serif", serif',
              fontSize: "22px",
              lineHeight: "1",
            }}
          >
            <span style={{ color: "#0f172a" }}>Deep</span>
            <span style={{ color: "#4f46e5" }}>Due</span>
            <span style={{ color: "#94a3b8", fontSize: "15px" }}>.ai</span>
          </div>

          {/* Nav links */}
          <div
            style={{ display: "flex", gap: "32px", alignItems: "center" }}
          >
            {["Product", "Pricing", "Docs"].map((link) => (
              <a
                key={link}
                href="#"
                style={{
                  color: "#475569",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                {link}
              </a>
            ))}
          </div>

          {/* Right buttons */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Link
              href="/login"
              style={{
                padding: "8px 16px",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                color: "#0f172a",
                fontSize: "14px",
                fontWeight: "500",
                backgroundColor: "transparent",
              }}
            >
              Sign in
            </Link>
            <Link
              href="/login"
              style={{
                padding: "8px 16px",
                backgroundColor: "#4f46e5",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          padding: "140px 32px 120px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Badge */}
          <div
            style={{
              display: "inline-block",
              padding: "6px 16px",
              backgroundColor: "rgba(79,70,229,0.08)",
              color: "#4f46e5",
              borderRadius: "100px",
              fontSize: "13px",
              fontWeight: "500",
              marginBottom: "32px",
            }}
          >
            ✦ Now in early access
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily:
                'var(--font-instrument-serif), "Instrument Serif", serif',
              fontSize: "52px",
              lineHeight: "1.15",
              color: "#0f172a",
              fontWeight: "400",
              maxWidth: "680px",
              margin: "0 auto 20px",
            }}
          >
            Know exactly who you&#39;re dealing with
          </h1>

          {/* Subheading */}
          <p
            style={{
              fontSize: "16px",
              color: "#475569",
              maxWidth: "520px",
              margin: "0 auto 36px",
              lineHeight: "1.7",
            }}
          >
            AI-powered company intelligence for UK businesses. Credit health,
            document analysis and director insights — in seconds.
          </p>

          {/* CTA Buttons */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              marginBottom: "52px",
            }}
          >
            <Link
              href="/login"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                backgroundColor: "#4f46e5",
                borderRadius: "8px",
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: "600",
              }}
            >
              Get started free
            </Link>
            <a
              href="#"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                color: "#0f172a",
                fontSize: "15px",
                fontWeight: "500",
                backgroundColor: "#ffffff",
              }}
            >
              See demo
            </a>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div style={{ textAlign: "center", padding: "0 28px" }}>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#0f172a",
                }}
              >
                4.2m+
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  marginTop: "3px",
                }}
              >
                companies
              </div>
            </div>
            <div
              style={{
                width: "1px",
                height: "28px",
                backgroundColor: "#e2e8f0",
              }}
            />
            <div style={{ textAlign: "center", padding: "0 28px" }}>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#0f172a",
                }}
              >
                Real-time CH data
              </div>
            </div>
            <div
              style={{
                width: "1px",
                height: "28px",
                backgroundColor: "#e2e8f0",
              }}
            />
            <div style={{ textAlign: "center", padding: "0 28px" }}>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: "700",
                  color: "#0f172a",
                }}
              >
                AI document analysis
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        style={{
          borderTop: "1px solid #e2e8f0",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          padding: "100px 32px",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "32px",
          }}
        >
          {/* Column 1 */}
          <div
            style={{
              padding: "32px",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              backgroundColor: "#f8fafc",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "rgba(79,70,229,0.1)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                marginBottom: "20px",
              }}
            >
              ✦
            </div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#0f172a",
                marginBottom: "12px",
              }}
            >
              AI Document Analysis
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "#475569",
                lineHeight: "1.75",
              }}
            >
              Claude reads every filed account and extracts what matters —
              going concern notes, cyber incidents, audit warnings.
            </p>
          </div>

          {/* Column 2 */}
          <div
            style={{
              padding: "32px",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              backgroundColor: "#f8fafc",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "rgba(79,70,229,0.1)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                marginBottom: "20px",
              }}
            >
              📊
            </div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#0f172a",
                marginBottom: "12px",
              }}
            >
              Clean Financials
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "#475569",
                lineHeight: "1.75",
              }}
            >
              Year on year comparisons and sector benchmarking. No more
              opening PDFs.
            </p>
          </div>

          {/* Column 3 */}
          <div
            style={{
              padding: "32px",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              backgroundColor: "#f8fafc",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "rgba(79,70,229,0.1)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                marginBottom: "20px",
              }}
            >
              🔔
            </div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "700",
                color: "#0f172a",
                marginBottom: "12px",
              }}
            >
              Live Monitoring
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: "#475569",
                lineHeight: "1.75",
              }}
            >
              Get alerted the moment a company files, changes a director, or
              triggers a risk flag.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
