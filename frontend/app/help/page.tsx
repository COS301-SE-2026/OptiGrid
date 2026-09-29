import Link from "next/link";
import type { ReactNode } from "react";
import { OptiGridLogo } from "@/components/logo";

const ICONS: Record<string, ReactNode> = {
    "User manual": (
        <>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </>
    ),
    Tutorials: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="m10 8 6 4-6 4V8z" />
        </>
    ),
    FAQs: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
        </>
    ),
    "Contact support": <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
};

const quickAccess = [
    {
        label: "User manual",
        href: "/help/manual",
        description: "Written guides with screenshots.",
        action: "Open manual",
        badge: "Step-by-step",
    },
    {
        label: "Tutorials",
        href: "/help/tutorials",
        description: "Short videos for common tasks. Each one has written steps too.",
        action: "View tutorials",
        badge: "Guided",
    },
    {
        label: "FAQs",
        href: "/faqs",
        description: "Quick answers to the questions people ask most.",
        action: "Read FAQs",
        badge: "Popular",
    },
    {
        label: "Contact support",
        href: "/contact",
        description: "Send the team a message when the guides do not solve your problem.",
        action: "Contact us",
        badge: "Direct help",
    },
];

export const metadata = {
    title: "Help Centre - OptiGrid",
    description: "Guides and answers for OptiGrid users.",
};

export default function HelpPage() {
    return (
        <div className="landing-page">
            <header className="navbar landing-nav" role="banner" aria-label="Site header">
                <div className="landing-shell landing-nav-inner">
                    <Link
                        href="/"
                        aria-label="OptiGrid home"
                        className="landing-wordmark"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            color: "var(--brand-ink)",
                            textDecoration: "none",
                        }}
                    >
                        <OptiGridLogo height={30} />
                    </Link>
                    <div className="landing-nav-actions">
                        <Link href="/dashboard" className="btn btn-primary">
                            Back to dashboard
                        </Link>
                    </div>
                </div>
            </header>
            <main role="main" aria-label="Help centre main content" className="help-main">
                <section id="resources" className="landing-section landing-section-alt help-anchor" aria-label="Help resources">
                    <div className="landing-shell">
                        <div className="landing-section-header">
                            <p className="landing-kicker">Quick access</p>
                            <h1>Help Centre</h1>
                            <h2 className="help-lead">
                                Find the help you need
                            </h2>
                            <p className="text-muted">
                                Pick a guide below. If you are still stuck the team is one message away.
                            </p>
                        </div>
                        <ul className="help-resource-grid" aria-label="Help resources list">
                            {quickAccess.map((resource) => (
                                <li key={resource.label} className="card help-resource-card">
                                    <div className="help-resource-header">
                                        <div className="icon-chip" aria-hidden="true">
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                {ICONS[resource.label]}
                                            </svg>
                                        </div>
                                        <div className="help-resource-content">
                                            <span className="badge badge-success">{resource.badge}</span>
                                            <h3>{resource.label}</h3>
                                            <p className="text-muted">{resource.description}</p>
                                        </div>
                                    </div>
                                    <div className="help-resource-actions">
                                        <Link
                                            href={resource.href}
                                            className="btn btn-primary"
                                            aria-label={`${resource.action} for ${resource.label}`}
                                        >
                                            {resource.action}
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            </main>
            <footer className="landing-footer" role="contentinfo" aria-label="Site footer">
                <div className="landing-shell">
                    <span>© 2026 OptiGrid. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}