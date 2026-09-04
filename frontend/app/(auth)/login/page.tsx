"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLoginError, initialLoginFormData, type LoginFormData } from "./validation";
import { navigateAfterLogin } from "../../../lib/auth-navigation";
import { getTabSessionId, TAB_SESSION_HEADER } from "../../../lib/tab-session";
import GoogleAuthButton from "@/components/GoogleButton";

export default function LoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState<LoginFormData>(initialLoginFormData);
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
        if (query.get("error") === "OAuthFailed") {
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
            navigateAfterLogin((destination) => {
                router.replace(destination);
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-page">
            <section
                className="card auth-card"
                aria-labelledby="login-title"
            >
                <header className="auth-header">
                    <Link href="/" className="landing-wordmark">
                        OptiGrid
                    </Link>
                    <p className="landing-kicker">OptiGrid Access</p>
                    <h1 id="login-title">Log in to your account</h1>
                </header>

                {notice && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="auth-notice"
                    >
                        {notice}
                    </div>
                )}

                <form
                    className="auth-form"
                    noValidate
                    onSubmit={handleSubmit}
                    suppressHydrationWarning
                >
                    <div className="auth-field">
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
                            aria-invalid={Boolean(error)}
                            suppressHydrationWarning
                        />
                    </div>

                    <div className="auth-field">
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
                            aria-invalid={Boolean(error)}
                            suppressHydrationWarning
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        aria-disabled={loading}
                        className="btn btn-primary auth-submit"
                        style={{
                            backgroundColor: "#3A6B7C",
                            color: "#FFFFFF",
                        }}
                    >
                        {loading ? "Logging in..." : "Log in"}
                    </button>

                    <GoogleAuthButton
                        onLoading={setLoading}
                        onError={setError}
                    />

                    {error && (
                        <div
                            role="alert"
                            aria-live="assertive"
                            className="auth-alert"
                        >
                            {error}
                        </div>
                    )}
                </form>

                <p className="text-muted auth-footnote">
                    No account?{" "}
                    <Link href="/signup">
                        Sign up free
                    </Link>
                </p>
            </section>
        </main>
    );
}