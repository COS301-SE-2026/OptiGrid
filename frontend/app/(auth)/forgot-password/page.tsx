"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import { emailPattern } from "../signup/validation";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setHydrated(true);
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = email.trim();
        if (!emailPattern.test(trimmed)) {
            setError("Enter a valid email address.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            const supabase = createClient();
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (resetError) {
                throw resetError;
            }
            setSent(true);
        } catch {
            setError("We could not send the email right now. Please wait a minute and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-page">
            <section className="card auth-card" aria-labelledby="forgot-title">
                <header className="auth-header">
                    <Link href="/" className="landing-wordmark">
                        OptiGrid
                    </Link>
                    <h1 id="forgot-title">Forgot your password?</h1>
                    <p className="text-muted auth-lede">Enter your email and we will send you a link to set a new one.</p>
                </header>

                {sent ? (
                    <div role="status" aria-live="polite" className="auth-notice">
                        If an account uses {email.trim()}, a reset link is on its way. Check your inbox and spam folder.
                    </div>
                ) : (
                    <form className="auth-form" noValidate onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <label className="label" htmlFor="email">Work email</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                className="input"
                                value={email}
                                onChange={(event) => {
                                    setEmail(event.target.value);
                                    if (error) setError("");
                                }}
                                disabled={!hydrated || loading}
                                placeholder="you@company.co.za"
                                aria-invalid={Boolean(error)}
                            />
                        </div>

                        <button type="submit" className="btn btn-primary auth-submit" disabled={!hydrated || loading}>
                            {loading ? "Sending..." : "Send reset link"}
                        </button>

                        {error && (
                            <div role="alert" aria-live="assertive" className="auth-alert">
                                {error}
                            </div>
                        )}
                    </form>
                )}

                <p className="text-muted auth-footnote">
                    Remembered it? <Link href="/login">Back to log in</Link>
                </p>
            </section>
        </main>
    );
}