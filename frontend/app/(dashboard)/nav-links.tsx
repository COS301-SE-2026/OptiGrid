"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Compare", href: "/compare" },
    { label: "Live", href: "/realtime" },
    { label: "Forecast", href: "/forecast" },
    { label: "admin", href: "/admin" },
    { label: "user admin", href:"/useradmin"},
];

export function NavLinks() {
    const pathname = usePathname();
    return (
        <nav className="dashboard-nav" aria-label="Dashboard">
            {navigation.map((item) => {
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
