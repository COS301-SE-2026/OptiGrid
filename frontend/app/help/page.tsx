import Link from "next/link";

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
            <header className="navbar landing-nav">
                <div className="landing-shell landing-nav-inner">
                    <Link href="/" className="landing-wordmark">
                        OptiGrid
                    </Link>
                    <div className="landing-nav-actions">
                        <Link href="/dashboard" className="btn btn-primary">
                            ← Back to dashboard
                        </Link>
                    </div>
                </div>
            </header>
            <main>
                <section id="resources" className="landing-section landing-section-alt help-anchor">
                    <div className="landing-shell">
                        <div className="landing-section-header">
                            <p className="landing-kicker">Quick access</p>
                            <h2>Pick one of the resources available below to help with your problem</h2>
                            <p className="text-muted">
                                Our help centre groups the most useful resources so you can
                                can find solutions and clarify confusions.
                            </p>
                        </div>
                        <div className="help-resource-grid">
                            {quickAccess.map((resource) => (
                                <div key={resource.label} className="card help-resource-card">
                                    <div className="help-resource-header">
                                        <div className="icon-chip" aria-hidden="true">
                                            {resource.label.slice(0, 1)}
                                        </div>
                                        <div className="help-resource-content">
                                            <span className="badge badge-success">{resource.badge}</span>
                                            <h3>{resource.label}</h3>
                                            <p className="text-muted">{resource.description}</p>
                                        </div>
                                    </div>
                                    <div className="help-resource-actions">
                                        <Link href={resource.href} className="btn btn-primary">
                                            {resource.action}
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
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