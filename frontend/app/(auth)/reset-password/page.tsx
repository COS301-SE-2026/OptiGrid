"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import PasswordInput from "@/components/PasswordInput";
import { getNewPasswordError } from "./validation";

type LinkState = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [linkState, setLinkState] = useState<LinkState>("checking");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let active = true;
        const supabase = createClient();

        const openRecoverySession = async () => {
            const query = new URLSearchParams(window.location.search);
            const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
            const code = query.get("code");
            const tokenHash = query.get("token_hash");

            try {
                const fromResetLink = Boolean(code || tokenHash || hash.get("type") === "recovery");
                if (!fromResetLink || query.get("error") || hash.get("error")) {
                    throw new Error("Link rejected");
                }
                if (code) {
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                    if (exchangeError) throw exchangeError;
                } else if (tokenHash) {
                    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
                    if (verifyError) throw verifyError;
                }

                const { data } = await supabase.auth.getSession();
                if (active) {
                    setLinkState(data.session ? "ready" : "invalid");
                }
            } catch {
                if (active) {
                    setLinkState("invalid");
                }
            }
        };

        void openRecoverySession();
        return () => {
            active = false;
        };
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const problem = getNewPasswordError(password, confirmPassword);
        if (problem) {
            setError(problem);
            return;
        }

        setError("");
        setSaving(true);
        try {
            const supabase = createClient();
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) {
                throw updateError;
            }
            await supabase.auth.signOut();
            router.push("/login?reset=1");
        } catch (updateError) {
            const message = updateError instanceof Error && updateError.message ? updateError.message : "";
            setError(message || "We could not change your password. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="auth-page">
            <section className="card auth-card" aria-labelledby="reset-title">
                <header className="auth-header">
                    <Link href="/" className="landing-wordmark">
                        OptiGrid
                    </Link>
                    <h1 id="reset-title">Set a new password</h1>
                    <p className="text-muted auth-lede">Pick a strong password that you will remember.</p>
                </header>

                {linkState === "checking" && (
                    <p role="status" aria-live="polite" className="text-muted">Checking your reset link...</p>
                )}

                {linkState === "invalid" && (
                    <div role="alert" className="auth-alert">
                        This reset link is invalid or has expired. <Link href="/forgot-password">Request a new link</Link>.
                    </div>
                )}

                {linkState === "ready" && (
                    <form className="auth-form" noValidate onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <label className="label" htmlFor="password">New password</label>
                            <PasswordInput
                                id="password"
                                name="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(event) => {
                                    setPassword(event.target.value);
                                    if (error) setError("");
                                }}
                                disabled={saving}
                                placeholder="At least 8 characters"
                                ariaInvalid={Boolean(error)}
                            />
                        </div>

                        <div className="auth-field">
                            <label className="label" htmlFor="confirmPassword">Confirm new password</label>
                            <PasswordInput
                                id="confirmPassword"
                                name="confirmPassword"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(event) => {
                                    setConfirmPassword(event.target.value);
                                    if (error) setError("");
                                }}
                                disabled={saving}
                                placeholder="Re-enter password"
                                ariaInvalid={Boolean(error)}
                            />
                        </div>

                        <p className="text-muted auth-hint">Use upper and lower case letters, a number and a symbol.</p>

                        <button type="submit" className="btn btn-primary auth-submit" disabled={saving}>
                            {saving ? "Saving..." : "Save new password"}
                        </button>

                        {error && (
                            <div role="alert" aria-live="assertive" className="auth-alert">
                                {error}
                            </div>
                        )}
                    </form>
                )}

                <p className="text-muted auth-footnote">
                    <Link href="/login">Back to log in</Link>
                </p>
            </section>
        </main>
    );
}