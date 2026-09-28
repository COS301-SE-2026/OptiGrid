import { cookies } from "next/headers";
import { parseSession, SESSION_COOKIE_NAME } from "../lib/session";
import { PublicNav } from "../components/PublicNav";
import Link from "next/link";

export const metadata = { title: "Page not found - OptiGrid" };

export default async function NotFound() {
    const cookieStore = await cookies();
    const signedIn = Boolean(parseSession(cookieStore.get(SESSION_COOKIE_NAME)?.value));
    return (
        <div className="landing-page">
            <PublicNav signedIn={signedIn} />
            <main className="status-page" aria-labelledby="not-found-title">
                <div className="card status-card">
                    <p className="landing-kicker">Error 404</p>
                    <h1 id="not-found-title">We could not find that page</h1>
                    <p className="text-muted">The link may be out of date or the page may have moved.</p>
                    <div className="status-actions">
                        {signedIn ? (
                            <Link href="/dashboard" className="btn btn-primary">Go to the dashboard</Link>
                        ) : (
                            <Link href="/" className="btn btn-primary">Go to the home page</Link>
                        )}
                        <Link href="/help" className="btn btn-secondary">Visit the Help Centre</Link>
                    </div>
                </div>
            </main>
            <footer className="landing-footer">
                <div className="landing-shell">
                    <span>© 2026 OptiGrid. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}