"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="status-inline">
            <div className="card status-card" role="alert">
                <p className="landing-kicker">Something went wrong</p>
                <h1>This page did not load</h1>
                <p className="text-muted">Try again in a moment. If it keeps happening please let the team know.</p>
                <div className="status-actions">
                    <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
                    <Link href="/contact" className="btn btn-secondary">Contact us</Link>
                </div>
            </div>
        </div>
    );
}