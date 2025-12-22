"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import styles from "./loginPage.module.css";
import { useSplashScreen } from "../hooks/useSpalshScreen";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useSplashScreen(true);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) setError(error.message);
    else router.push("/");
  }

  return (
    <main className={styles.container}>
      {/* Subtle background pattern */}
      <div className={styles.bgPattern} />
      
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoText}>G</span>
          </div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>
            Sign in to your gios.build workspace
          </p>
        </header>

        <form onSubmit={signIn} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.submitBtn}
          >
            {loading ? (
              <span className={styles.btnLoading}>
                <span className={styles.btnSpinner} />
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>

          {error && (
            <div className={styles.error} role="alert">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </form>

        <footer className={styles.footer}>
          <span className={styles.footerText}>Private dashboard for</span>
          <a 
            href="https://gios.build" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.footerLink}
          >
            gios.build
          </a>
        </footer>
      </div>

      {/* Footer credit */}
      <div className={styles.credit}>
        <span>Powered by Supabase</span>
      </div>
    </main>
  );
}