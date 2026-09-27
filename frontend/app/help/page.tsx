import Link from "next/link";
import type { ReactNode } from "react";

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
        description: "Learn the core workflows for logging in, adding buildings, and navigating the portfolio views.",
        action: "Open manual",
        badge: "Step-by-step",
    },
    {
        label: "Tutorials",
        href: "/help/tutorials",
        description: "Follow guided walkthroughs for the most common tasks completed by the users of OptiGrid.",
        action: "View tutorials",
        badge: "Guided",
    },
    {
        label: "FAQs",
        href: "/faqs",
        description: "Jump straight to the answers for frequently asked questions about OptiGrid.",
        action: "Read FAQs",
        badge: "Popular",
    },
    {
        label: "Contact support",
        href: "/contact",
        description: "Reach out to our support team if you need help with an issue that the guides do not cover.",
        action: "Contact us",
        badge: "Direct help",
    },
];

export const metadata = {
    title: "Help Centre - OptiGrid",
    description: "Quick access to OptiGrid manuals, tutorials, FAQs, and support.",
};

export default function HelpPage() {
    return (
        <div className="landing-page">
            <header className="navbar landing-nav" role="banner" aria-label="Site header">
                <div className="landing-shell landing-nav-inner">
                    <Link href="/" className="landing-wordmark" aria-label="OptiGrid home">
                        OptiGrid
                    </Link>
                    <div className="landing-nav-actions">
                        <Link href="/dashboard" className="btn btn-primary">
                            Back to dashboard
                        </Link>
                    </div>
                </div>
            </header>
            <main role="main" aria-label="Help centre main content">
                <section id="resources" className="landing-section landing-section-alt help-anchor" aria-label="Help resources">
                    <div className="landing-shell">
                        <div className="landing-section-header">
                            <p className="landing-kicker">Quick access</p>
                            <h1>Help Centre</h1>
                            <h2 className="help-lead">
                                Pick one of the resources available below to help with your problem
                            </h2>
                            <p className="text-muted">
                                Our help centre groups the most useful resources so you can
                                find solutions and clarify confusions.
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