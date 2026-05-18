import Link from "next/link";
import type { ReactNode } from "react";

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
            "Compare buildings side-by-side to surface inefficiencies and best practices.",
    },
    {
        icon: <TrendingUpIcon />,
        title: "Forecast tomorrow's demand",
        description:
            "ML-driven predictions help you plan procurement and avoid peak tariffs.",
    },
];

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* Navbar */}
            <header className="border-b border-slate-800">
                <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <span className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-100">
                        ⚡ OptiGrid
                    </span>
                    <div className="flex items-center gap-6">
                        <div className="hidden items-center gap-6 text-sm text-slate-400 sm:flex">
                            <a
                                href="#"
                                className="transition-colors hover:text-slate-100"
                            >
                                Features
                            </a>
                            <a
                                href="#"
                                className="transition-colors hover:text-slate-100"
                            >
                                Pricing
                            </a>
                            <a
                                href="#"
                                className="transition-colors hover:text-slate-100"
                            >
                                Contact
                            </a>
                        </div>
                        <Link
                            href="/login"
                            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-slate-100"
                        >
                            Log in
                        </Link>
                    </div>
                </nav>
            </header>

            {/* Hero */}
            <section className="mx-auto max-w-3xl px-6 py-24 text-center">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                    Energy intelligence platform
                </p>
                <h1 className="mb-6 text-4xl font-semibold leading-tight text-slate-100 sm:text-5xl">
                    Cut energy costs across
                    <br className="hidden sm:block" /> every building you operate.
                </h1>
                <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-slate-300">
                    OptiGrid unifies IoT telemetry, anomaly detection, and demand
                    forecasting into one dashboard — so facility teams act on data
                    instead of guessing.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link
                        href="/signup"
                        className="rounded-xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300"
                    >
                        Get started free
                    </Link>
                    <a
                        href="#"
                        className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
                    >
                        Book a demo
                    </a>
                </div>
            </section>

            {/* Features */}
            <section className="mx-auto max-w-6xl px-6 pb-24">
                <p className="mb-10 text-center text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                    What you can do
                </p>
                <div className="grid gap-6 sm:grid-cols-3">
                    {features.map((feature) => (
                        <div
                            key={feature.title}
                            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-7"
                        >
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                                {feature.icon}
                            </div>
                            <h3 className="mb-2 text-sm font-semibold text-slate-100">
                                {feature.title}
                            </h3>
                            <p className="text-sm leading-relaxed text-slate-400">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-800 py-8">
                <p className="text-center text-xs text-slate-500">
                    © 2026 OptiGrid
                </p>
            </footer>
        </div>
    );
}
