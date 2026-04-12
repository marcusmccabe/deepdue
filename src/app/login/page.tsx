import Link from "next/link";

export default function LoginPage() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily:
          'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
      }}
    >
      {/* ── Left Panel — Indigo ── */}
      <div
        style={{
          width: "50%",
          backgroundColor: "#4f46e5",
          padding: "48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontFamily:
              'var(--font-instrument-serif), "Instrument Serif", serif',
            fontSize: "26px",
            color: "#ffffff",
            lineHeight: "1",
          }}
        >
          DeepDue.ai
        </div>

        {/* Quote */}
        <div>
          <p
            style={{
              fontFamily:
                'var(--font-instrument-serif), "Instrument Serif", serif',
              fontSize: "30px",
              color: "#ffffff",
              fontStyle: "italic",
              lineHeight: "1.4",
              marginBottom: "16px",
            }}
          >
            &ldquo;Saved us 3 hours per credit review.&rdquo;
          </p>
          <p
            style={{
              fontSize: "14px",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            — Finance Director, mid-size law firm
          </p>
        </div>

        {/* Pill badges */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {["4.2m companies", "Real-time data", "AI insights"].map((badge) => (
            <span
              key={badge}
              style={{
                padding: "6px 14px",
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: "100px",
                fontSize: "12px",
                color: "#ffffff",
                fontWeight: "500",
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* ── Right Panel — White ── */}
      <div
        style={{
          width: "50%",
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "360px" }}>
          {/* Heading */}
          <h2
            style={{
              fontFamily:
                'var(--font-instrument-serif), "Instrument Serif", serif',
              fontSize: "30px",
              color: "#0f172a",
              fontWeight: "400",
              marginBottom: "8px",
            }}
          >
            Welcome back
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "#94a3b8",
              marginBottom: "28px",
            }}
          >
            Sign in to your DeepDue account
          </p>

          {/* Google Button */}
          <button
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              width: "100%",
              padding: "11px 16px",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#0f172a",
              fontWeight: "500",
              cursor: "pointer",
              marginBottom: "20px",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}
            />
            <span
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                whiteSpace: "nowrap",
              }}
            >
              or email
            </span>
            <div
              style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}
            />
          </div>

          {/* Email */}
          <input
            type="email"
            placeholder="Email address"
            style={{
              display: "block",
              width: "100%",
              padding: "11px 14px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#0f172a",
              marginBottom: "12px",
              outline: "none",
              backgroundColor: "#ffffff",
            }}
          />

          {/* Password */}
          <input
            type="password"
            placeholder="Password"
            style={{
              display: "block",
              width: "100%",
              padding: "11px 14px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#0f172a",
              marginBottom: "16px",
              outline: "none",
              backgroundColor: "#ffffff",
            }}
          />

          {/* Sign In Button */}
          <Link
            href="/dashboard"
            style={{
              display: "block",
              width: "100%",
              padding: "11px 16px",
              backgroundColor: "#4f46e5",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: "600",
              textAlign: "center",
              marginBottom: "20px",
            }}
          >
            Sign in
          </Link>

          {/* Footer link */}
          <p
            style={{
              textAlign: "center",
              fontSize: "13px",
              color: "#94a3b8",
            }}
          >
            No account?{" "}
            <Link
              href="/login"
              style={{ color: "#4f46e5", fontWeight: "500" }}
            >
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
