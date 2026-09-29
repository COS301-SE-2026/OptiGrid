"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { getLoginError, initialLoginFormData, type LoginFormData } from "./validation";
import { navigateAfterLogin } from "../../../lib/auth-navigation";
import { getTabSessionId, TAB_SESSION_HEADER } from "../../../lib/tab-session";
import GoogleAuthButton from "@/components/GoogleButton";
import PasswordInput from "@/components/PasswordInput";

export default function LoginPage() {
    const [formData, setFormData] = useState<LoginFormData>(initialLoginFormData);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const [deactivated, setDeactivated] = useState(false);
    const [googleDeactivated, setGoogleDeactivated] = useState(false);

    useEffect(() => {
        setHydrated(true);
        const query = new URLSearchParams(window.location.search);
        const signupState = query.get("signup");
        const loggedOut = query.get("loggedOut");
        const emailFromQuery = query.get("email");

        if (signupState === "success") {
            setNotice("Account created successfully. Please log in.");
        } else if (query.get("reset") === "1") {
            setNotice("Your password has been changed. Log in with your new password.");
        } else if (query.get("deleted") === "1") {
            setNotice("Your account has been deleted. To get it back, log in with the same email and password and choose Recover account.");
        } else if (loggedOut === "1") {
            setNotice("You have been logged out.");
        }

        if (emailFromQuery) {
            setFormData((previous) => ({
                ...previous,
                email: previous.email || emailFromQuery,
            }));
        }
        const oauthError = query.get("error");
        if (oauthError === "OAuthFailed") {
            setError("Google sign-in failed. Please try again.");
        } else if (oauthError === "OAuthDeactivated") {
            setGoogleDeactivated(true);
        } else if (oauthError === "OAuthRecoverFailed") {
            setError("We could not recover this account. Please try again.");
        }
    }, []);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((p) => ({ ...p, [name]: value }));
        if (error) setError("");
        if (deactivated) setDeactivated(false);
    };

    const handleRecover = async () => {
        setError("");
        setLoading(true);
        try {
            const tabSessionId = getTabSessionId();
            const res = await fetch("/api/auth/recover-account", {
                method: "POST",
                headers: { "Content-Type": "application/json", [TAB_SESSION_HEADER]: tabSessionId ?? "" },
                body: JSON.stringify(formData),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.message || "We could not recover this account. Try again.");
            }

            setDeactivated(false);
            setNotice("Welcome back. Your account has been recovered.");
            await navigateAfterLogin(undefined, tabSessionId);
            setFormData(initialLoginFormData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "We could not recover this account. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const msg = getLoginError(formData);
        if (msg) { setError(msg); return; }
        setError("");
        setLoading(true);
        try {
            const tabSessionId = getTabSessionId();
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json", [TAB_SESSION_HEADER]: tabSessionId ?? "" },
                body: JSON.stringify(formData),
            });

            const payload = await res.json().catch(() => ({}));

            if (res.status === 403 && payload?.code === "ACCOUNT_DEACTIVATED") {
                setDeactivated(true);
                return;
            }
            if (!res.ok) {
                throw new Error(payload?.message || "Login failed. Try again.");
            }

            const firstName = payload?.user?.firstName as string | undefined;
            setNotice(`Login successful${firstName ? `, ${firstName}` : ""}.`);
            await navigateAfterLogin(undefined, tabSessionId);
            setFormData(initialLoginFormData);
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
                    <h1 id="login-title">Log in to your account</h1>
                    <p className="text-muted auth-lede">Sign in to see your buildings and live readings.</p>
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
                    method="post"
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
                            disabled={!hydrated || loading}
                            className="input"
                            placeholder="you@company.co.za"
                            aria-invalid={Boolean(error)}
                            suppressHydrationWarning
                        />
                    </div>

                    <div className="auth-field">
                        <div className="auth-label-row">
                            <label className="label" htmlFor="password">Password</label>
                            <Link href="/forgot-password" className="auth-link">Forgot password?</Link>
                        </div>
                        <PasswordInput
                            id="password"
                            name="password"
                            autoComplete="current-password"
                            value={formData.password}
                            onChange={handleChange}
                            disabled={!hydrated || loading}
                            placeholder="Your password"
                            ariaInvalid={Boolean(error)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!hydrated || loading}
                        aria-disabled={!hydrated || loading}
                        className="btn btn-primary auth-submit"
                    >
                        {!hydrated ? "Loading..." : loading ? "Logging in..." : "Log in"}
                    </button>

                    <GoogleAuthButton
                        onLoading={setLoading}
                        onError={setError}
                    />

                    {googleDeactivated && (
                        <div role="alert" aria-live="assertive" className="auth-recover">
                            <p>This Google account was deleted. You can bring it back by signing in with Google again.</p>
                            <GoogleAuthButton
                                intent="recover"
                                label="Recover with Google"
                                showDivider={false}
                                onLoading={setLoading}
                                onError={setError}
                            />
                        </div>
                    )}

                    {deactivated && (
                        <div role="alert" aria-live="assertive" className="auth-recover">
                            <p>This account was deleted. You can bring it back with the email and password above.</p>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleRecover}
                                disabled={loading}
                            >
                                {loading ? "Recovering..." : "Recover account"}
                            </button>
                        </div>
                    )}

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
