"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Compare", href: "/compare" },
    { label: "Live", href: "/realtime" },
    { label: "Forecast", href: "/forecast" },
    { label: "Insights", href: "/insights" },
    { label: "Admin", href: "/admin", roles: ["ADMIN"] },
    { label: "Billing", href: "/billing", roles: ["ADMIN"] },
    { label: "Audit", href: "/audit", roles: ["ADMIN"] },
    { label: "Manage", href: "/manager", roles: ["BUILDING_MANAGER"] },
    { label: "Settings", href:"/settings"},
   
    
];

export function NavLinks({ role }: { role?: string }) {
    const pathname = usePathname();
    return (
        <nav className="dashboard-nav" aria-label="Dashboard">
            {navigation
                .filter((item) => !item.roles || (role && item.roles.includes(role)))
                .map((item) => {
                    const active =
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/");
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
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
