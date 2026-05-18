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

    const inputClass =
        "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:opacity-50";

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
                        Start optimising in minutes. Monitor energy usage, spot anomalies, and unlock optimization insights across your buildings.
                    </p>
                </header>

                <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-200" htmlFor="firstName">
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
                                aria-describedby={showError("firstName") ? "firstName-error" : undefined}
                                className={inputClass}
                                placeholder="Avery"
                            />
                            {showError("firstName") && (
                                <p id="firstName-error" role="alert" className="text-xs text-rose-300">
                                    {errors.firstName}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-200" htmlFor="lastName">
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
                                aria-describedby={showError("lastName") ? "lastName-error" : undefined}
                                className={inputClass}
                                placeholder="Rivera"
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
                            aria-describedby={showError("email") ? "email-error" : undefined}
                            className={inputClass}
                            placeholder="avery.rivera@company.io"
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
                            disabled={loading}
                            aria-invalid={showError("password")}
                            aria-describedby={showError("password") ? "password-error" : undefined}
                            className={inputClass}
                            placeholder="At least 8 characters"
                        />
                        {showError("password") && (
                            <p id="password-error" role="alert" className="text-xs text-rose-300">
                                {errors.password}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-200" htmlFor="confirmPassword">
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
                            aria-describedby={showError("confirmPassword") ? "confirmPassword-error" : undefined}
                            className={inputClass}
                            placeholder="Re-enter password"
                        />
                        {showError("confirmPassword") && (
                            <p id="confirmPassword-error" role="alert" className="text-xs text-rose-300">
                                {errors.confirmPassword}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? "Creating account…" : "Create account"}
                    </button>

                    {apiError && (
                        <div
                            role="alert"
                            className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
                        >
                            {apiError}
                        </div>
                    )}
                </form>

                <p className="mt-6 text-center text-sm text-slate-400">
                    Have an account?{" "}
                    <Link
                        href="/login"
                        className="font-medium text-emerald-400 hover:text-emerald-300"
                    >
                        Log in
                    </Link>
                </p>
            </div>
        </main>
    );
}
