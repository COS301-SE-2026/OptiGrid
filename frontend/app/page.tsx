import Link from "next/link";
import type { ReactNode } from "react";
import { PublicNav } from "../components/PublicNav";

function FeatureIcon({ children }: Readonly<{ children: ReactNode }>) {
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
            {children}
        </svg>
    );
}

function MonitorIcon() {
    return (
        <FeatureIcon>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
        </FeatureIcon>
    );
}

function BarChartIcon() {
    return (
        <FeatureIcon>
            <path d="M3 3v18h18" />
            <path d="M7 16v-4M11 16V8M15 16v-6" />
        </FeatureIcon>
    );
}

function TrendingUpIcon() {
    return (
        <FeatureIcon>
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
        </FeatureIcon>
    );
}

function AlertIcon() {
    return (
        <FeatureIcon>
            <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            <path d="M12 9v4M12 17h.01" />
        </FeatureIcon>
    );
}

function LightbulbIcon() {
    return (
        <FeatureIcon>
            <path d="M9 18h6M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2z" />
        </FeatureIcon>
    );
}

function MapIcon() {
    return (
        <FeatureIcon>
            <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
            <path d="M9 4v14M15 6v14" />
        </FeatureIcon>
    );
}

function CubeIcon() {
    return (
        <FeatureIcon>
            <path d="M12 2 3 7v10l9 5 9-5V7l-9-5z" />
            <path d="M3 7l9 5 9-5M12 12v10" />
        </FeatureIcon>
    );
}

function ReceiptIcon() {
    return (
        <FeatureIcon>
            <path d="M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2l-3 2-2-2-2 2-2-2-2 2z" />
            <path d="M9 8h6M9 12h6" />
        </FeatureIcon>
    );
}

const features: { icon: ReactNode; title: string; description: string }[] = [
    {
        icon: <MonitorIcon />,
        title: "Monitor your portfolio",
        description: "See live power and today's energy use for every building on one screen.",
    },
    {
        icon: <MapIcon />,
        title: "See usage on a map",
        description: "A heatmap shows which sites use the most energy. Slide back in time or look ahead.",
    },
    {
        icon: <CubeIcon />,
        title: "Explore each building in 3D",
        description: "Turn a model of the building around and find the sensor that is working too hard.",
    },
    {
        icon: <AlertIcon />,
        title: "Catch anomalies early",
        description: "You get an alert when a reading leaves its normal range.",
    },
    {
        icon: <BarChartIcon />,
        title: "Benchmark performance",
        description: "Put two buildings side by side and find out which one uses energy better.",
    },
    {
        icon: <TrendingUpIcon />,
        title: "Forecast tomorrow's demand",
        description: "Plan your week with an hourly forecast. Switch to twelve weeks for the long view.",
    },
    {
        icon: <LightbulbIcon />,
        title: "Act on load shifting insights",
        description: "Each tip names the load to move and what you could save every month.",
    },
    {
        icon: <ReceiptIcon />,
        title: "Keep tariffs and costs current",
        description: "Enter your summer and winter rates. Every cost then matches your real bill.",
    },
];

const outcomes = [
    {
        metric: "18%",
        title: "Peak load reduction",
        description: "Moving load out of peak hours keeps demand under your contract limit.",
    },
    {
        metric: "4.8%",
        title: "Forecast error",
        description: "Our forecasts stay close to what your buildings really use.",
    },
    {
        metric: "120+",
        title: "Buildings online",
        description: "Meters and sensors connect in days rather than months.",
    },
    {
        metric: "5s",
        title: "Live refresh",
        description: "Readings on screen are never more than a few seconds old.",
    },
    {
        metric: "4",
        title: "Measures watched",
        description: "Every reading is checked on four measures for unusual jumps.",
    },
    {
        metric: "12 weeks",
        title: "Forecast horizon",
        description: "Look one week ahead in detail or twelve weeks ahead for the bigger picture.",
    },
    {
        metric: "ISO 50001",
        title: "Audit ready reports",
        description: "Download a signed report that your auditor can check against the records.",
    },
    {
        metric: "0 to 100",
        title: "ESG health score",
        description: "Try a change with a slider and watch your score move before you spend anything.",
    },
];

export default function LandingPage() {
    return (
        <div className="landing-page">
            <PublicNav signedIn={false} anchorPrefix="" />

            <main>
                <section className="landing-hero landing-screen">
                    <div className="landing-shell landing-hero-grid">
                        <div className="landing-hero-content">
                            <p className="landing-kicker">Energy intelligence platform</p>
                            <h1>Cut energy costs across every building you operate.</h1>
                            <p className="landing-lede text-muted">
                                OptiGrid shows what each of your buildings uses right now.
                                It warns you when something looks wrong. It also tells you
                                what to change to pay less.
                            </p>
                            <div className="landing-actions">
                                <a href="#features" className="btn btn-secondary">
                                    See what it does
                                </a>
                            </div>
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
                            <div className="landing-panel-alert">
                                <span className="landing-panel-alert-dot" aria-hidden="true" />
                                <p>
                                    <strong>Rosebank Tower</strong> is drawing 22% more than usual.
                                </p>
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

                <section id="features" className="landing-section landing-section-alt landing-screen" style={{ scrollMarginTop: "var(--landing-nav-height)" }}>
                    <div className="landing-shell">
                        <div className="landing-section-header">
                            <p className="landing-kicker">What you can do</p>
                            <h2>One view for every building.</h2>
                            <p className="text-muted">
                                Everything you need to run your sites sits in one place.
                                Start with the live view and dig deeper when you need to.
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

                <section id="outcomes" className="landing-section landing-screen" style={{ scrollMarginTop: "var(--landing-nav-height)" }}>
                    <div className="landing-shell">
                        <div className="landing-section-header">
                            <p className="landing-kicker">Operational impact</p>
                            <h2>Move from raw telemetry to decisions.</h2>
                            <p className="text-muted">
                                Clear numbers help your team act sooner. Less time goes
                                into guessing and more into saving.
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
