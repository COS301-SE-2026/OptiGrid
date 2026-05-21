"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Card, Title, TextInput, Button } from "@tremor/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLoginError, initialLoginFormData, type LoginFormData } from "./validation";

export default function LoginPage() {
    const router = useRouter();
    const [isClientReady, setIsClientReady] = useState(false);
    const [formData, setFormData] = useState<LoginFormData>(
        initialLoginFormData
    );

    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setIsClientReady(true);

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
    }, []);

    if (!isClientReady) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
                <Card className="w-full max-w-md space-y-6 p-6">
                    <Title>Login</Title>
                    <p className="text-sm text-gray-600">Preparing sign-in form...</p>
                </Card>
            </div>
        );
    }

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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const payload = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(payload?.message || "Login failed. Try again.");
            }

            const firstName = payload?.user?.firstName as string | undefined;
            setNotice(`Login successful${firstName ? `, ${firstName}` : ""}.`);
            setFormData(initialLoginFormData);
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed. Please try again.");
        } finally {
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
                    >
                        {loading ? "Logging in..." : "Log in"}
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
