"use client";

import {useState, type ChangeEvent, type FocusEvent, type SubmitEvent} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {getSubmitResult, hasErrors, shouldShowError, type SignupErrors, type SignupTouched } from "./logic";
import { initialSignupFormData, type SignupFormData } from "./validation";
import { getTabSessionId, getTabSessionPath, TAB_SESSION_HEADER } from "../../../lib/tab-session";
import GoogleAuthButton from "@/components/googleButton";

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
                headers: { "Content-Type": "application/json", [TAB_SESSION_HEADER]: getTabSessionId() ?? "" },
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

            router.push(getTabSessionPath("/dashboard"));
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
            style={{
                minHeight: "100vh",
                background: "var(--brand-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-5)",
            }}
        >
            <section
                className="card"
                style={{ width: "min(420px, 100%)", display: "grid", gap: "var(--space-4)" }}
            >
                <header style={{ display: "grid", gap: "var(--space-1)" }}>
                    <Link href="/" className="landing-wordmark">
                        OptiGrid
                    </Link>
                    <p className="landing-kicker">OptiGrid Access</p>
                    <h1>Create your account</h1>
                    <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                        Monitor usage, catch anomalies, and start saving in minutes.
                    </p>
                </header>

                <form style={{
                        display: "grid",
                        gap: "var(--space-4)"
                    }} noValidate onSubmit={handleSubmit} suppressHydrationWarning>
                    <div
                        style={{
                            display: "grid",
                            gap: "var(--space-4)",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
                        }}
                    >
                        <div style={{ 
                                display: "grid", 
                                gap: "var(--space-1)" 
                            }}>
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
                                suppressHydrationWarning
                            />
                            {showError("firstName") && (
                                <p
                                    id="firstName-error"
                                    role="alert"
                                    style={{
                                        color: "var(--brand-danger)",
                                        fontSize: "var(--fs-small)",
                                    }}
                                >
                                    {errors.firstName}
                                </p>
                            )}
                        </div>

                        <div style={{ 
                                display: "grid", 
                                gap: "var(--space-1)" 
                            }}>
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
                                suppressHydrationWarning
                            />
                            {showError("lastName") && (
                                <p
                                    id="lastName-error"
                                    role="alert"
                                    style={{
                                        color: "var(--brand-danger)",
                                        fontSize: "var(--fs-small)",
                                    }}
                                >
                                    {errors.lastName}
                                </p>
                            )}
                        </div>
                    </div>

                    <div style={{ 
                            display: "grid", 
                            gap: "var(--space-1)" 
                        }}>
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
                            suppressHydrationWarning
                        />
                        {showError("email") && (
                            <p
                                id="email-error"
                                role="alert"
                                style={{
                                    color: "var(--brand-danger)",
                                    fontSize: "var(--fs-small)",
                                }}
                            >
                                {errors.email}
                            </p>
                        )}
                    </div>

                    <div style={{ 
                            display: "grid",
                            gap: "var(--space-1)" 
                        }}>
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
                            suppressHydrationWarning
                        />
                        {showError("password") && (
                            <p
                                id="password-error"
                                role="alert"
                                style={{
                                    color: "var(--brand-danger)",
                                    fontSize: "var(--fs-small)",
                                }}
                            >
                                {errors.password}
                            </p>
                        )}
                    </div>

                    <div style={{ 
                            display: "grid", 
                            gap: "var(--space-1)" 
                        }}>
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
                            suppressHydrationWarning
                        />
                        {showError("confirmPassword") && (
                            <p
                                id="confirmPassword-error"
                                role="alert"
                                style={{
                                    color: "var(--brand-danger)",
                                    fontSize: "var(--fs-small)",
                                }}
                            >
                                {errors.confirmPassword}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ 
                            width: "100%",
                            backgroundColor: "#3A6B7C",
                            color: "#FFFFFF",
                            fontWeight: "var(--fw-semibold)",
                            fontSize: "var(--fs-body)",
                        }}
                    >
                        {loading ? "Creating account..." : "Create account"}
                    </button>
                    
                    <GoogleAuthButton 
                        onLoading={setLoading} 
                        onError={setApiError}> 
                    </GoogleAuthButton>

                    {apiError && (
                        <div
                            role="alert"
                            style={{
                                border: "1px solid var(--brand-danger)",
                                background:
                                    "color-mix(in srgb, var(--brand-danger) 12%, transparent)",
                                color: "var(--brand-danger)",
                                padding: "var(--space-3) var(--space-4)",
                                borderRadius: "var(--radius-md)",
                                fontSize: "var(--fs-small)",
                            }}
                        >
                            {apiError}
                        </div>
                    )}
                </form>

                <p
                    className="text-muted"
                    style={{ textAlign: "center", fontSize: "var(--fs-small)" }}
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