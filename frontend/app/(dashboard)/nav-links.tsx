"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Compare", href: "/compare" },
    { label: "Forecast", href: "/forecast" },
];

export function NavLinks() {
    const pathname = usePathname();
    return (
        <nav className="mt-8 space-y-2 text-sm">
            {navigation.map((item) => {
                const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`block rounded-lg px-3 py-2 transition-colors ${
                            active
                                ? "bg-emerald-400/10 font-medium text-emerald-400"
                                : "text-slate-200 hover:bg-slate-800"
                        }`}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}