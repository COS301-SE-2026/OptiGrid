"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { getTabSessionPath, stripTabSessionPath } from "../../lib/tab-session";
import { NavIcon, type NavIconName } from "./nav-icons";

const subscribeToHydration = () => () => {};

function useHasHydrated(): boolean {
    return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

type NavItem = {
    label: string;
    href: string;
    icon: NavIconName;
    roles?: string[];
    also?: string[];
};

const sections: { title: string; items: NavItem[] }[] = [
    {
        title: "Monitoring",
        items: [
            { label: "Dashboard", href: "/dashboard", icon: "dashboard", also: ["/buildings"] },
            { label: "Live", href: "/realtime", icon: "live" },
            { label: "Heatmap", href: "/heatmap", icon: "heatmap" },
            { label: "Anomaly", href: "/anomaly", icon: "anomaly", roles: ["BUILDING_MANAGER"] },
            { label: "Anomaly", href: "/useranomaly", icon: "anomaly", roles: ["VIEWER"] },
        ],
    },
    {
        title: "Analysis",
        items: [
            { label: "Compare", href: "/compare", icon: "compare" },
            { label: "Forecast", href: "/forecast", icon: "forecast" },
            { label: "Insights", href: "/insights", icon: "insights" },
        ],
    },
    {
        title: "Reporting",
        items: [
            { label: "ESG", href: "/esg", icon: "esg" },
            { label: "Compliance", href: "/compliance", icon: "compliance" },
        ],
    },
    {
        title: "Administration",
        items: [
            { label: "Admin", href: "/admin", icon: "building", roles: ["ADMIN"], also: ["/useradmin"] },
            { label: "Tariff rates", href: "/billing", icon: "tariff", roles: ["ADMIN"] },
            { label: "Audit", href: "/audit", icon: "audit", roles: ["ADMIN"] },
            { label: "Manage", href: "/manager", icon: "building", roles: ["BUILDING_MANAGER"] },
        ],
    },
];

const supportLinks: NavItem[] = [
    { label: "Settings", href: "/settings", icon: "settings" },
    { label: "Help Centre", href: "/help", icon: "help" },
    { label: "Contact Us", href: "/contact", icon: "contact" },
];

const pageTitles: Array<[RegExp, string]> = [
    [/^\/buildings\/add$/, "Add building"],
    [/^\/buildings\/[^/]+\/edit$/, "Edit building"],
    [/^\/buildings\/[^/]+\/sensors$/, "Sensors"],
    [/^\/buildings\/[^/]+\/view$/, "Building details"],
    [/^\/useradmin$/, "User management"],
];

function canSee(item: NavItem, role?: string) {
    return !item.roles || (role !== undefined && item.roles.includes(role));
}

function isWithin(pathname: string, base: string) {
    return pathname === base || pathname.startsWith(base + "/");
}

function isActive(item: NavItem, pathname: string) {
    return [item.href, ...(item.also ?? [])].some((base) => isWithin(pathname, base));
}

export function NavLinks({ role }: { readonly role?: string }) {
    const pathname = stripTabSessionPath(usePathname());
    const hasHydrated = useHasHydrated();
    const activeRef = useRef<HTMLAnchorElement>(null);
    const activeLabel = [...sections.flatMap((section) => section.items), ...supportLinks]
        .find((item) => canSee(item, role) && isActive(item, pathname))?.label;

    
    useEffect(() => {
        const label = pageTitles.find(([pattern]) => pattern.test(pathname))?.[1] ?? activeLabel;
        const title = label ? `${label} - OptiGrid` : "OptiGrid";
        const keepTitle = () => {
            if (document.title !== title) {
                document.title = title;
            }
        };
        keepTitle();
        const observer = new MutationObserver(keepTitle);
        observer.observe(document.head, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
    }, [pathname, activeLabel]);

    useEffect(() => {
        const link = activeRef.current;
        const row = link?.closest(".dashboard-navgroup");
        if (!link || !row || row.scrollWidth <= row.clientWidth) {
            return;
        }
        const offset = link.getBoundingClientRect().left - row.getBoundingClientRect().left;
        row.scrollLeft += offset - (row.clientWidth - link.offsetWidth) / 2;
    }, [pathname]);

    const renderLink = (item: NavItem) => {
        const active = isActive(item, pathname);
        return (
            <Link
                key={item.href}
                ref={active ? activeRef : undefined}
                href={hasHydrated ? getTabSessionPath(item.href) : item.href}
                className={`dashboard-link${active ? " dashboard-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
            >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
            </Link>
        );
    };

    return (
        <div className="dashboard-navgroup">
            <nav className="dashboard-nav" aria-label="Dashboard">
                {sections.map((section) => {
                    const items = section.items.filter((item) => canSee(item, role));
                    if (items.length === 0) {
                        return null;
                    }
                    return (
                        <div key={section.title} className="dashboard-nav-section">
                            <p className="dashboard-nav-title" aria-hidden="true">{section.title}</p>
                            <ul className="dashboard-nav-list" aria-label={section.title}>
                                {items.map((item) => (
                                    <li key={item.href}>{renderLink(item)}</li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </nav>
            <nav className="dashboard-utility" aria-label="Account and support">
                {supportLinks.map(renderLink)}
            </nav>
        </div>
    );
}
