"use client";

import {
    useState,
    type ChangeEvent,
    type FocusEvent,
    type SubmitEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    getSubmitResult,
    hasErrors,
    shouldShowError,
    type SignupErrors,
    type SignupTouched,
} from "./logic";
import { initialSignupFormData, type SignupFormData } from "./validation";

export default function SignupPage() {
    const router = useRouter();
    const [formData, setFormData] = useState<SignupFormData>(initialSignupFormData);
    const [errors, setErrors] = useState<SignupErrors>({});
    const [touched, setTouched] = useState<SignupTouched>({});
    const [loading, setLoading] = useState(false);
    const [apiError, setApiError] = useState("");

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData((previous) => ({ ...previous, [name]: value }));
        if (apiError) setApiError("");
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
        const { name } = event.target;
        setTouched((previous) => ({ ...previous, [name]: true }));
    };

    const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();

        const result = getSubmitResult(formData);
        setErrors(result.errors);
        setTouched(result.touched);

        if (hasErrors(result.errors)) return;

        setLoading(true);
        setApiError("");

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    password: formData.password,
                }),
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.message ?? "Registration failed. Please try again.");
            }

            router.push("/dashboard");
        } catch (err) {
            setApiError(
                err instanceof Error ? err.message : "Registration failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    const showError = (field: keyof SignupFormData) =>
        shouldShowError(field, errors, touched);

    const inputClass = "input";
    const errorStyle = {
        borderColor: "var(--brand-danger)",
        boxShadow:
            "0 0 0 2px var(--brand-bg), 0 0 0 4px var(--brand-danger)",
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
                    <h1>Create your account</h1>
                    <p className="text-muted" style={{ fontSize: "0.95rem" }}>
                        Start optimizing in minutes. Monitor energy usage, spot
                        anomalies, and unlock optimization insights across your
                        buildings.
                    </p>
                </header>

                <form className="space-y-5" noValidate onSubmit={handleSubmit}>
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="label" htmlFor="firstName">
                                First name
                            </label>
                            <input
                                id="firstName"
                                name="firstName"
                                type="text"
                                autoComplete="given-name"
                                value={formData.firstName}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                disabled={loading}
                                aria-invalid={showError("firstName")}
                                aria-describedby={
                                    showError("firstName") ? "firstName-error" : undefined
                                }
                                className={inputClass}
                                style={showError("firstName") ? errorStyle : undefined}
                                placeholder="Abdelrahman"
                            />
                            {showError("firstName") && (
                                <p
                                    id="firstName-error"
                                    role="alert"
                                    style={{
                                        color: "var(--brand-danger)",
                                        fontSize: "0.75rem",
                                    }}
                                >
                                    {errors.firstName}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="label" htmlFor="lastName">
                                Last name
                            </label>
                            <input
                                id="lastName"
                                name="lastName"
                                type="text"
                                autoComplete="family-name"
                                value={formData.lastName}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                disabled={loading}
                                aria-invalid={showError("lastName")}
                                aria-describedby={
                                    showError("lastName") ? "lastName-error" : undefined
                                }
                                className={inputClass}
                                style={showError("lastName") ? errorStyle : undefined}
                                placeholder="Esam"
                            />
                            {showError("lastName") && (
                                <p
                                    id="lastName-error"
                                    role="alert"
                                    style={{
                                        color: "var(--brand-danger)",
                                        fontSize: "0.75rem",
                                    }}
                                >
                                    {errors.lastName}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="label" htmlFor="email">
                            Work email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={formData.email}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            disabled={loading}
                            aria-invalid={showError("email")}
                            aria-describedby={
                                showError("email") ? "email-error" : undefined
                            }
                            className={inputClass}
                            style={showError("email") ? errorStyle : undefined}
                            placeholder="abdelrahman.esam@company.io"
                        />
                        {showError("email") && (
                            <p
                                id="email-error"
                                role="alert"
                                style={{
                                    color: "var(--brand-danger)",
                                    fontSize: "0.75rem",
                                }}
                            >
                                {errors.email}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="label" htmlFor="password">
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            value={formData.password}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            disabled={loading}
                            aria-invalid={showError("password")}
                            aria-describedby={
                                showError("password") ? "password-error" : undefined
                            }
                            className={inputClass}
                            style={showError("password") ? errorStyle : undefined}
                            placeholder="At least 8 characters"
                        />
                        {showError("password") && (
                            <p
                                id="password-error"
                                role="alert"
                                style={{
                                    color: "var(--brand-danger)",
                                    fontSize: "0.75rem",
                                }}
                            >
                                {errors.password}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="label" htmlFor="confirmPassword">
                            Confirm password
                        </label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            disabled={loading}
                            aria-invalid={showError("confirmPassword")}
                            aria-describedby={
                                showError("confirmPassword")
                                    ? "confirmPassword-error"
                                    : undefined
                            }
                            className={inputClass}
                            style={showError("confirmPassword") ? errorStyle : undefined}
                            placeholder="Re-enter password"
                        />
                        {showError("confirmPassword") && (
                            <p
                                id="confirmPassword-error"
                                role="alert"
                                style={{
                                    color: "var(--brand-danger)",
                                    fontSize: "0.75rem",
                                }}
                            >
                                {errors.confirmPassword}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full"
                    >
                        {loading ? "Creating account..." : "Create account"}
                    </button>

                    {apiError && (
                        <div
                            role="alert"
                            style={{
                                border: "1px solid var(--brand-danger)",
                                background:
                                    "color-mix(in srgb, var(--brand-danger) 12%, transparent)",
                                color: "var(--brand-danger)",
                                padding: "12px 16px",
                                borderRadius: "var(--radius-md)",
                                fontSize: "0.875rem",
                            }}
                        >
                            {apiError}
                        </div>
                    )}
                </form>

                <p
                    className="text-muted"
                    style={{ textAlign: "center", fontSize: "0.875rem" }}
                >
                    Have an account?{" "}
                    <Link
                        href="/login"
                        style={{
                            color: "var(--brand-primary)",
                            fontWeight: 600,
                        }}
                    >
                        Log in
                    </Link>
                </p>
            </section>
        </main>
    );
}
