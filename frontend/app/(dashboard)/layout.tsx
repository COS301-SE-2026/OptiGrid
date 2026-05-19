import type { ReactNode } from "react";
import { NavLinks } from "./nav-links";

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto flex min-h-screen max-w-6xl">
                <aside className="w-60 shrink-0 border-r border-slate-800 px-6 py-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        OptiGrid
                    </p>
                    <NavLinks />
                </aside>
                <main className="flex-1 px-8 py-10">{children}</main>
            </div>
        </div>
    );
}
