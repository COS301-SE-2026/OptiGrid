import type { ReactNode } from "react";
import Link from "next/link";

const navigation = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Compare", href: "/compare" },
    { label: "Forecast", href: "/forecast" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto flex min-h-screen max-w-6xl">
                <aside className="w-60 border-r border-slate-800 px-6 py-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        OptiGrid
                    </p>
                    <nav className="mt-8 space-y-2 text-sm">
                        {navigation.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="block rounded-lg px-3 py-2 text-slate-200 hover:bg-slate-800"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </aside>
                <main className="flex-1 px-8 py-10">{children}</main>
            </div>
        </div>
    );
}
