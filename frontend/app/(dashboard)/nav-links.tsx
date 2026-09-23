"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getTabSessionPath, stripTabSessionPath } from "../../lib/tab-session";

const navigation = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Compare", href: "/compare" },
    { label: "Live", href: "/realtime" },
    { label: "Heatmap", href: "/heatmap" },
    { label: "Forecast", href: "/forecast" },
    { label: "Insights", href: "/insights" },
    { label: "ESG", href:"/esg"},
    { label: "Compliance", href: "/compliance" },
    { label: "Admin", href: "/admin", roles: ["ADMIN"] },
    { label: "Tariff rates", href: "/billing", roles: ["ADMIN"] },
    { label: "Audit", href: "/audit", roles: ["ADMIN"] },
    { label: "Manage", href: "/manager", roles: ["BUILDING_MANAGER"] },
    { label: "Anomaly", href: "/anomaly", roles:["BUILDING_MANAGER"]},
    { label: "Anomaly", href: "/useranomaly", roles:["VIEWER"]},
    { label: "Settings", href:"/settings"},
   
    
];

export function NavLinks({ role }: { readonly role?: string }) {
    const pathname = usePathname();
    return (
        <nav className="dashboard-nav" aria-label="Dashboard">
            {navigation
                .filter((item) => !item.roles || (role && item.roles.includes(role)))
                .map((item) => {
                    const cleanPathname = stripTabSessionPath(pathname);
                    const active =
                        cleanPathname === item.href ||
                        cleanPathname.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.href}
                            href={getTabSessionPath(item.href)}
                            className={`dashboard-link ${active ? "dashboard-link-active" : ""
                                }`}
                            aria-current={active ? "page" : undefined}
                        >
                            {item.label}
                        </Link>
                    );
                })}
        </nav>
    );
}
