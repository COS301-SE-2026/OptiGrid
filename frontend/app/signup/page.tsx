"use client";

import { useMemo, useState, type ChangeEvent, type FocusEvent, type SubmitEvent } from "react";
import { getSubmitResult, hasErrors, shouldShowError, type SignupErrors, type SignupTouched } from "./logic";
import { initialSignupFormData, type SignupFormData } from "./validation";

export default function SignupPage() {
    const [formData, setFormData] = useState<SignupFormData>(initialSignupFormData);
    const [errors, setErrors] = useState<SignupErrors>({});
    const [touched, setTouched] = useState<SignupTouched>({});
    const [status, setStatus] = useState<"idle" | "success">("idle");
    const hasAnyErrors = useMemo(() => hasErrors(errors), [errors]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData((previous) => ({ ...previous, [name]: value }));
        if (status === "success") {
            setStatus("idle");
        }
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
        const { name } = event.target;
        setTouched((previous) => ({ ...previous, [name]: true }));
    };

    const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const result = getSubmitResult(formData);
        setErrors(result.errors);
        setTouched(result.touched);
        setStatus(result.status);
        setFormData(result.nextFormData);
    };

    const showError = (field: keyof SignupFormData) => shouldShowError(field, errors, touched);

    return (
        <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
            <div className="mx-auto w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl shadow-slate-950/40">
                <header className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                        OptiGrid Access
                    </p>
                    <h1 className="text-3xl font-semibold text-slate-100">
                        Create your account
                    </h1>
                    <p className="text-sm text-slate-300">
                        Join the platform to monitor energy usage, spot anomalies, and unlock optimization insights across your buildings.
                    </p>
                </header>
                <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-200" htmlFor="firstName">
                                First Name
                            </label>
                            <input
                                id="firstName"
                                name="firstName"
                                type="text"
                                autoComplete="given-name"
                                value={formData.firstName}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                aria-invalid={showError("firstName")}
                                aria-describedby={
                                    showError("firstName")
                                        ? "firstName-error"
                                        : undefined
                                }
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30" placeholder="Avery"
                            />
                            {showError("firstName") && (
                                <p id="firstName-error" role="alert" className="text-xs text-rose-300">
                                    {errors.firstName}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-200" htmlFor="lastName">
                                Last Name
                            </label>
                            <input
                                id="lastName"
                                name="lastName"
                                type="text"
                                autoComplete="family-name"
                                value={formData.lastName}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                aria-invalid={showError("lastName")}
                                aria-describedby={
                                    showError("lastName")
                                        ? "lastName-error"
                                        : undefined
                                }
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30" placeholder="Rivera"
                            />
                            {showError("lastName") && (
                                <p id="lastName-error" role="alert" className="text-xs text-rose-300">
                                    {errors.lastName}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-200" htmlFor="email">
                            Email Address
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={formData.email}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            aria-invalid={showError("email")}
                            aria-describedby={
                                showError("email") ? "email-error" : undefined
                            }
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30" placeholder="avery.rivera@optigrid.io"
                        />
                        {showError("email") && (
                            <p id="email-error" role="alert" className="text-xs text-rose-300">
                                {errors.email}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-200" htmlFor="password">
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
                            aria-invalid={showError("password")}
                            aria-describedby={
                                showError("password")
                                    ? "password-error"
                                    : undefined
                            }
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30" placeholder="At least 8 characters"
                        />
                        {showError("password") && (
                            <p id="password-error" role="alert" className="text-xs text-rose-300">
                                {errors.password}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-200" htmlFor="confirmPassword">
                            Confirm Password
                        </label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            aria-invalid={showError("confirmPassword")}
                            aria-describedby={
                                showError("confirmPassword")
                                    ? "confirmPassword-error"
                                    : undefined
                            }
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30" placeholder="Re-enter password"/>
                        {showError("confirmPassword") && (
                            <p id="confirmPassword-error" role="alert" className="text-xs text-rose-300">
                                {errors.confirmPassword}
                            </p>
                        )}
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
                        By creating an account, you will be enrolled in OptiGrid's multi-site energy optimization workspace.
                    </div>
                    <button type="submit" className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200">
                        Create account
                    </button>
                    {status === "success" && !hasAnyErrors && (
                        <div role="status" className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                            Account created. Check your inbox to verify your workspace access.
                        </div>
                    )}
                </form>
            </div>
        </main>
    );
}
