"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputStyle: React.CSSProperties = {
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
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function GoogleIcon() {
  return (
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
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signUpSent, setSignUpSent] = useState(false);

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (mode === "signup") {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
      } else {
        setSignUpSent(true);
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) {
        setError(err.message);
      } else {
        router.push("/dashboard");
      }
    }

    setLoading(false);
  }

  function switchMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError("");
    setSignUpSent(false);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", sans-serif',
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          boxShadow:
            "0 1px 3px rgba(0,0,0,0.05), 0 8px 32px rgba(0,0,0,0.08)",
          padding: "40px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontFamily:
              'var(--font-instrument-serif), "Instrument Serif", serif',
            fontSize: "22px",
            lineHeight: "1",
            marginBottom: "32px",
          }}
        >
          <span style={{ color: "#0f172a" }}>Deep</span>
          <span style={{ color: "#4f46e5" }}>Due</span>
          <span style={{ color: "#94a3b8", fontSize: "15px" }}>.ai</span>
        </div>

        {/* Page title */}
        <h1
          style={{
            fontFamily:
              'var(--font-instrument-serif), "Instrument Serif", serif',
            fontSize: "26px",
            fontWeight: "400",
            color: "#0f172a",
            marginBottom: "6px",
            lineHeight: "1.2",
          }}
        >
          {mode === "signin" ? "Sign in to DeepDue" : "Create your account"}
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#94a3b8",
            marginBottom: "28px",
          }}
        >
          {mode === "signin"
            ? "Welcome back. Enter your details to continue."
            : "Start your free trial — no credit card required."}
        </p>

        {/* ── Sign-up success state ── */}
        {signUpSent ? (
          <div
            style={{
              padding: "16px",
              backgroundColor: "rgba(5,150,105,0.07)",
              border: "1px solid rgba(5,150,105,0.2)",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#065f46",
              lineHeight: "1.55",
              marginBottom: "20px",
            }}
          >
            <strong>Check your email.</strong> We sent a confirmation link to{" "}
            <strong>{email}</strong>. Click it to activate your account.
          </div>
        ) : (
          <>
            {/* Google OAuth button */}
            <button
              onClick={signInWithGoogle}
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
                fontFamily: "inherit",
              }}
            >
              <GoogleIcon />
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
                or
              </span>
              <div
                style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}
              />
            </div>

            {/* Email / password form */}
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
              {mode === "signup" && (
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "11px 16px",
                  backgroundColor: "#4f46e5",
                  borderRadius: "8px",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: loading ? "default" : "pointer",
                  fontFamily: "inherit",
                  marginBottom: "12px",
                  opacity: loading ? 0.75 : 1,
                }}
              >
                {loading
                  ? "Please wait…"
                  : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              </button>

              {error && (
                <p
                  style={{
                    fontSize: "13px",
                    color: "#dc2626",
                    lineHeight: "1.4",
                    marginBottom: "4px",
                  }}
                >
                  {error}
                </p>
              )}
            </form>
          </>
        )}

        {/* Mode toggle */}
        <p
          style={{
            textAlign: "center",
            fontSize: "13px",
            color: "#94a3b8",
            marginTop: signUpSent ? "0" : "8px",
          }}
        >
          {mode === "signin"
            ? "Don't have an account? "
            : "Already have an account? "}
          <button
            onClick={switchMode}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "#4f46e5",
              fontWeight: "600",
              fontSize: "13px",
              fontFamily: "inherit",
            }}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
