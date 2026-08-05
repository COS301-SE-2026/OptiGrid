"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLoginError, initialLoginFormData, type LoginFormData } from "./validation";
import { getTabSessionId, getTabSessionPath, TAB_SESSION_HEADER } from "../../../lib/tab-session";
import { createClient } from "@/lib/supabaseClient"; 

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState<LoginFormData>(
        initialLoginFormData
    );

    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        const signupState = query.get("signup");
        const loggedOut = query.get("loggedOut");
        const emailFromQuery = query.get("email");

        if (signupState === "success") {
            setNotice("Account created successfully. Please log in.");
        } else if (loggedOut === "1") {
            setNotice("You have been logged out.");
        }

        if (emailFromQuery) {
            setFormData((previous) => ({
                ...previous,
                email: previous.email || emailFromQuery,
            }));
        }
        if(query.get("error") === "OAuthFailed") {
            setError("Google sign-in failed. Please try again.");
        }
    }, []);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((p) => ({ ...p, [name]: value }));
        if (error) setError("");
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const msg = getLoginError(formData);
        if (msg) { setError(msg); return; }
        setError("");
        setLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json", [TAB_SESSION_HEADER]: getTabSessionId() ?? "" },
                body: JSON.stringify(formData),
            });

            const payload = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(payload?.message || "Login failed. Try again.");
            }

            const firstName = payload?.user?.firstName as string | undefined;
            setNotice(`Login successful${firstName ? `, ${firstName}` : ""}.`);
            setFormData(initialLoginFormData);
            router.push(getTabSessionPath("/dashboard"));
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async() => {
        const supabase = createClient();
        setLoading(true);
        const {error} = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `will_fix_when_path_created`,
            },
        });
        if(error) {
            setError(error.message);
            setLoading(false);
        }
    };

    return (
        <main
            className="min-h-screen"
            style={{
                background: "var(--brand-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 24px",
            }}
        >
            <section
                className="card"
                style={{ width: "min(420px, 100%)", display: "grid", gap: "24px" }}
            >
                <header style={{ display: "grid", gap: "8px" }}>
                    <Link href="/" className="landing-wordmark">
                        OptiGrid
                    </Link>
                    <p className="landing-kicker">OptiGrid Access</p>
                    <h1>Log in to your account</h1>
                </header>

                {notice && (
                    <div
                        style={{
                            border: "1px solid var(--brand-secondary)",
                            background: "color-mix(in srgb, var(--brand-secondary) 12%, transparent)",
                            color: "var(--brand-ink)",
                            padding: "12px 16px",
                            borderRadius: "var(--radius-md)",
                            fontSize: "0.875rem",
                        }}
                    >
                        {notice}
                    </div>
                )}

                <form className="space-y-5" noValidate onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <label className="label" htmlFor="email">Work email</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={loading}
                            className="input"
                            placeholder="you@company.io"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            value={formData.password}
                            onChange={handleChange}
                            disabled={loading}
                            className="input"
                            placeholder="Your password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full"
                        style={{ marginTop: "24px" }}
                    >
                        {loading ? "Logging in..." : "Log in"}
                    </button>

                    {/** google auth button */}
                    <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0' }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--brand-secondary)' }} ></div>
                        <span style={{ padding: '0 10px', fontSize: '0.875rem', color: 'var(--brand-ink)' }}>or</span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--brand-secondary)' }} ></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="btn btn-secondary w-full"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Continue with Google    
                    </button>
                    {error && (
                        <div
                            role="alert"
                            style={{
                                border: "1px solid var(--brand-danger)",
                                background: "color-mix(in srgb, var(--brand-danger) 12%, transparent)",
                                color: "var(--brand-danger)",
                                padding: "12px 16px",
                                borderRadius: "var(--radius-md)",
                                fontSize: "0.875rem",
                            }}
                        >
                            {error}
                        </div>
                    )}
                </form>

                <p
                    className="text-muted"
                    style={{ textAlign: "center", fontSize: "0.875rem" }}
                >
                    No account?{" "}
                    <Link href="/signup" style={{ color: "var(--brand-primary)", fontWeight: 600 }}>
                        Sign up free
                    </Link>
                </p>
            </section>
        </main>
    );
}
