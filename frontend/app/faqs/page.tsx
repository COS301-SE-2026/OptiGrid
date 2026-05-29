import Link from "next/link";
import { cookies } from "next/headers";
import { parseSession, SESSION_COOKIE_NAME } from "../../lib/session";
import { Categories } from "./data";
import { FAQAccordion } from "./accordion"

export const metadata = { title: "FAQs - OptiGrid" };

export default async function FaqsPage() {
    const cookieStore = await cookies();
    const sessionName = cookieStore.get(SESSION_COOKIE_NAME);
    const user = parseSession(sessionName?.value);

    return (
        <div className="landing-page">
            <header className="navbar landing-nav">
                <div className="landing-shell landing-nav-inner">
                    <Link href="/" className="landing-wordmark">OptiGrid</Link>
                    <nav className="landing-links" aria-label="Primary">
                        <Link href="/#features">Features</Link>
                        <Link href="/#outcomes">Outcomes</Link>
                    </nav>
                    <div className="landing-nav-actions">
                        {user ? (
                            <Link href="/dashboard" className="btn btn-primary">Back to dashboard</Link>
                        ) : (
                            <>
                                <Link href="/login" className="btn btn-secondary">Log in</Link>
                                <Link href="/signup" className="btn btn-primary">Get started free</Link>
                            </>
                        )}
                    </div>
                </div>
            </header>
            <main>
                <section className="landing-section">
                    <div className="landing-shell">
                        <div className="landing-section-header">
                            <h1>Frequently Asked Questions</h1>
                            <p className="text-muted">
                                Everything you need to know about OptiGrid 
                            </p>
                        </div>
                        <FAQAccordion category={Categories} />
                    </div>
                </section>
            </main>
            <footer className="landing-footer">
                <div className="landing-shell">
                    <span>© 2026 OptiGrid. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}