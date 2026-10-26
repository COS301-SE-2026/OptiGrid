"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PublicNav } from "../components/PublicNav";

// Pages outside the dashboard land here
export default function AppError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="landing-page">
            <PublicNav signedIn={false} detectSession />
            <main className="status-page" aria-labelledby="app-error-title">
                <div className="card status-card" role="alert">
                    <p className="landing-kicker">Something went wrong</p>
                    <h1 id="app-error-title">This page did not load</h1>
                    <p className="text-muted">Try again in a moment. If it keeps happening please let the team know.</p>
                    <div className="status-actions">
                        <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
                        <Link href="/contact" className="btn btn-secondary">Contact us</Link>
                    </div>
                </div>
            </main>
        </div>
    );
}