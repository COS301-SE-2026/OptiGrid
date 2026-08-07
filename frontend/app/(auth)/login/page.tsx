"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLoginError, initialLoginFormData, type LoginFormData } from "./validation";
import { navigateAfterLogin } from "../../../lib/auth-navigation";
import { getTabSessionId, TAB_SESSION_HEADER } from "../../../lib/tab-session";
import GoogleAuthButton from "@/components/googleButton";

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
            navigateAfterLogin((destination) => router.replace(destination));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main
            style={{
                minHeight: "100vh",
                background: "var(--brand-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-7) var(--space-5)",
            }}
        >
            <section
                className="card"
                style={{ width: "min(420px, 100%)", display: "grid", gap: "var(--space-5)" }}
            >
                <header style={{ display: "grid", gap: "var(--space-2)" }}>
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
                            padding: "var(--space-3) var(--space-4)",
                            borderRadius: "var(--radius-md)",
                            fontSize: "var(--fs-small)",
                        }}
                    >
                        {notice}
                    </div>
                )}

                <form style={{ 
                        display: "grid", 
                        gap: "var(--space-5)" 
                    }} 
                    noValidate onSubmit={handleSubmit} suppressHydrationWarning>
                    <div style={{ 
                            display: "grid", 
                            gap: "var(--space-2)" 
                        }}>
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
                            suppressHydrationWarning
                        />
                    </div>

                    <div style={{ display: "grid", gap: "var(--space-2)" }}>
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
                            suppressHydrationWarning
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ width: "100%", marginTop: "var(--space-5)" }}
                    >
                        {loading ? "Logging in..." : "Log in"}
                    </button>

                    <GoogleAuthButton 
                        onLoading={setLoading} 
                        onError={setError}> 
                    </GoogleAuthButton>

                    {error && (
                        <div
                            role="alert"
                            style={{
                                border: "1px solid var(--brand-danger)",
                                background: "color-mix(in srgb, var(--brand-danger) 12%, transparent)",
                                color: "var(--brand-danger)",
                                padding: "var(--space-3) var(--space-4)",
                                borderRadius: "var(--radius-md)",
                                fontSize: "var(--fs-small)",
                            }}
                        >
                            {error}
                        </div>
                    )}
                </form>

                <p
                    className="text-muted"
                    style={{ textAlign: "center", fontSize: "var(--fs-small)" }}
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
