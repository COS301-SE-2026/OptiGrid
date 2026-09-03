import Link from "next/link";
import type { ReactNode } from "react";
import { PublicNav } from "../components/PublicNav";

function MonitorIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
        </svg>
    );
}

function BarChartIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M3 3v18h18" />
            <path d="M7 16v-4M11 16V8M15 16v-6" />
        </svg>
    );
}

function TrendingUpIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
        </svg>
    );
}

function AlertIcon() {
    return (
        <svg
            height="20"
            width="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            <path d="M12 9v4M12 17h.01" />
        </svg>
    );
}

function LightbulbIcon() {
    return (
        <svg
            height="20"
            width="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M9 18h6M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2z" />
        </svg>
    );
}

function ReceiptIcon() {
    return (
        <svg
            height="20"
            width="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2l-3 2-2-2-2 2-2-2-2 2z" />
            <path d="M9 8h6M9 12h6" />
        </svg>
    );
}

const features: { icon: ReactNode; title: string; description: string }[] = [
    {
        icon: <MonitorIcon />,
        title: "Monitor your portfolio",
        description:
            "Live kWh, peak load, and cost metrics for every building in one place.",
    },
    {
        icon: <BarChartIcon />,
        title: "Benchmark performance",
        description:
            "Compare buildings side by side to surface inefficiencies and best practices.",
    },
    {
        icon: <TrendingUpIcon />,
        title: "Forecast tomorrow's demand",
        description:
            "ML-driven predictions help you plan procurement and avoid peak tariffs.",
    },
    {
        icon: <AlertIcon />,
        title: "Catch anomalies early",
        description: "Voltage, current, power, and energy are watched for readings outside the expected range."
    },
    {
        icon: <LightbulbIcon />,
        title: "Act on load shifting insights",
        description: "Recommendations set out the load to move, the window, and the estimated monthly saving."
    },
    {
        icon: <ReceiptIcon />,
        title: "Keep tariffs and costs current",
        description: "Tariff rates keep every cost and saving figure tied to what you actually pay."
    },
];

const outcomes = [
    {
        metric: "18%",
        title: "Peak load reduction",
        description: "Automated curtailment plans keep demand under contract limits.",
    },
    {
        metric: "4.8%",
        title: "Forecast error",
        description: "Short term load forecasts reduce procurement guesswork.",
    },
    {
        metric: "120+",
        title: "Buildings online",
        description: "Connect meters, BMS, and IoT gateways in days, not months.",
    },
    {
        metric: "5s",
        title: "Live refresh",
        description: "Building details refresh every five seconds as sensors report in."
    },
    {
        metric: "4",
        title: "Measures watched",
        description: "Voltage, current, power, and energy are each monitored for anomalies."
    },
    {
        metric: "12 weeks",
        title: "Forecast horizon",
        description: "Weekly and monthly views cover the next seven days out to twelve weeks."
    },
];

export default function LandingPage() {
    return (
        <div className="landing-page">
            <PublicNav signedIn={false} anchorPrefix="" />

            <main>
                <section className="landing-hero">
                    <div className="landing-shell landing-hero-grid">
                        <div className="landing-hero-content">
                            <p className="landing-kicker">Energy intelligence platform</p>
                            <h1>Cut energy costs across every building you operate.</h1>
                            <p className="landing-lede text-muted">
                                OptiGrid unifies IoT telemetry, anomaly detection, and
                                demand forecasting so facility teams act on data instead
                                of guessing.
                            </p>
                            <div className="landing-metrics">
                                <div className="metric-card">
                                    <span className="metric">4.8%</span>
                                    <span className="text-muted">MAPE forecast error</span>
                                </div>
                                <div className="metric-card">
                                    <span className="metric">18%</span>
                                    <span className="text-muted">Peak load reduction</span>
                                </div>
                                <div className="metric-card">
                                    <span className="metric">R 9.4M</span>
                                    <span className="text-muted">Annual savings tracked</span>
                                </div>
                            </div>
                        </div>
                        <div className="card landing-hero-card">
                            <div className="landing-panel-header">
                                <div>
                                    <p className="landing-panel-title">Live portfolio</p>
                                    <p className="landing-panel-subtitle text-muted">
                                        Synced 2 min ago
                                    </p>
                                </div>
                                <span className="badge badge-success">Normal</span>
                            </div>
                            <div className="landing-panel-list">
                                <div className="landing-panel-row">
                                    <div>
                                        <p className="landing-panel-name">Sandton HQ</p>
                                        <p className="landing-panel-meta">Office, Johannesburg</p>
                                    </div>
                                    <div className="landing-panel-metric">
                                        <span className="metric">1,847 kWh</span>
                                        <span className="text-muted">Today</span>
                                    </div>
                                </div>
                                <div className="landing-panel-row">
                                    <div>
                                        <p className="landing-panel-name">Rosebank Tower</p>
                                        <p className="landing-panel-meta">Office, Gauteng</p>
                                    </div>
                                    <div className="landing-panel-metric">
                                        <span className="metric">1,512 kWh</span>
                                        <span className="text-muted">Today</span>
                                    </div>
                                </div>
                                <div className="landing-panel-row">
                                    <div>
                                        <p className="landing-panel-name">Cape Town Campus</p>
                                        <p className="landing-panel-meta">Mixed use, Western Cape</p>
                                    </div>
                                    <div className="landing-panel-metric">
                                        <span className="metric">1,268 kWh</span>
                                        <span className="text-muted">Today</span>
                                    </div>
                                </div>
                            </div>
                            <div className="landing-panel-footer">
                                <div>
                                    <p className="text-muted">Next peak window</p>
                                    <p className="metric">18:00 - 20:00</p>
                                </div>
                                <div>
                                    <p className="text-muted">Projected cost</p>
                                    <p className="metric">R 42,800</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="features" className="landing-section landing-section-alt" style={{ scrollMarginTop: "72px" }}>
                    <div className="landing-shell">
                        <div className="landing-section-header">
                            <p className="landing-kicker">What you can do</p>
                            <h2>One view for every building.</h2>
                            <p className="text-muted">
                                Surface anomalies, compare portfolios, and track every
                                tariff shift in a single operational workspace.
                            </p>
                        </div>
                        <div className="landing-feature-grid">
                            {features.map((feature) => (
                                <div key={feature.title} className="card landing-feature-card">
                                    <div className="icon-chip">{feature.icon}</div>
                                    <h3>{feature.title}</h3>
                                    <p className="text-muted">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="outcomes" className="landing-section" style={{ scrollMarginTop: "72px" }}>
                    <div className="landing-shell">
                        <div className="landing-section-header">
                            <p className="landing-kicker">Operational impact</p>
                            <h2>Move from raw telemetry to decisions.</h2>
                            <p className="text-muted">
                                OptiGrid blends real time monitoring with predictive
                                analytics to keep teams ahead of tariffs and downtime.
                            </p>
                        </div>
                        <div className="landing-outcomes-grid">
                            {outcomes.map((outcome) => (
                                <div key={outcome.title} className="card landing-outcome-card">
                                    <span className="metric">{outcome.metric}</span>
                                    <h3>{outcome.title}</h3>
                                    <p className="text-muted">{outcome.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="contact" className="landing-cta">
                    <div className="landing-shell">
                        <div className="landing-cta-inner">
                            <div>
                                <p className="landing-kicker">Ready to optimize</p>
                                <h2>Build a smarter energy strategy this quarter.</h2>
                            </div>
                            <div className="landing-actions">
                                <Link href="/signup" className="btn btn-primary">
                                    Start your free trial
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="landing-footer">
                <div className="landing-shell">
                    <nav className="landing-links" aria-label="Footer" style={{ justifyContent: "center", marginBottom: "var(--space-3)" }}>
                        <Link href="/contact">Contact</Link>
                        <Link href="/faqs">FAQs</Link>
                    </nav>
                    <span>© 2026 OptiGrid. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}
