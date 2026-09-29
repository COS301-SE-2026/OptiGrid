import type { ReactNode } from "react";

export type NavIconName =
    | "dashboard"
    | "live"
    | "heatmap"
    | "anomaly"
    | "compare"
    | "forecast"
    | "insights"
    | "esg"
    | "compliance"
    | "building"
    | "tariff"
    | "audit"
    | "settings"
    | "help"
    | "contact"
    | "logout";

const shapes: Record<NavIconName, ReactNode> = {
    dashboard: (
        <>
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </>
    ),
    live: <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />,
    heatmap: (
        <>
            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
            <circle cx="12" cy="10" r="2.5" />
        </>
    ),
    anomaly: (
        <>
            <path d="M12 4 2.8 19.5h18.4z" />
            <path d="M12 10v4.5M12 17.2v.1" />
        </>
    ),
    compare: <path d="M7 7h13m-4-4 4 4-4 4M17 17H4m4-4-4 4 4 4" />,
    forecast: <path d="m3 17 6-6 4 4 8-8m-6 0h6v6" />,
    insights: (
        <>
            <path d="M9 18h6M10 21h4" />
            <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z" />
        </>
    ),
    esg: <path d="M4.5 19.5C4.5 10 10 4.5 19.5 4.5c0 9.5-5.5 15-15 15zm0 0L13 11" />,
    compliance: (
        <>
            <path d="M12 3 5 6v5.5c0 4.3 3 8 7 9.5 4-1.5 7-5.2 7-9.5V6z" />
            <path d="m9 12 2 2 4-4" />
        </>
    ),
    building: (
        <>
            <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
            <path d="M9 7.5h1.5m3 0H15M9 11h1.5m3 0H15m-6 3.5h1.5m3 0H15m-4.5 6V18h3v2.5" />
        </>
    ),
    tariff: (
        <>
            <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z" />
            <path d="M9 8h6m-6 4h6m-6 4h3" />
        </>
    ),
    audit: (
        <>
            <path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="2.5" width="6" height="3" rx="1" />
            <path d="M9 11h6m-6 4h4" />
        </>
    ),
    settings: (
        <>
            <path d="M10.5 5.1 10.9 2.8h2.2l.4 2.3 2.4.9 1.9-1.3 1.5 1.5L18 8.1l.9 2.4 2.3.4v2.2l-2.3.4-.9 2.4 1.3 1.9-1.5 1.5-1.9-1.3-2.4.9-.4 2.3h-2.2l-.4-2.3-2.4-.9-1.9 1.3-1.5-1.5L6 15.9l-.9-2.4-2.3-.4v-2.2l2.3-.4.9-2.4-1.3-1.9 1.5-1.5L8.1 6z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    help: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.2-2.4 3.8M12 17v.1" />
        </>
    ),
    contact: (
        <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3.5 6.5 8.5 6 8.5-6" />
        </>
    ),
    logout: <path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3m7 12 4-4-4-4m4 4H9" />,
};

export function NavIcon({ name }: { readonly name: NavIconName }) {
    return (
        <svg
            className="dashboard-link-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {shapes[name]}
        </svg>
    );
}