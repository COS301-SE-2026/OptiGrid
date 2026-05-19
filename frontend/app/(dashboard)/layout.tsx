import type { ReactNode } from "react";
import { NavLinks } from "./nav-links";

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className="dashboard-page">
            <div className="dashboard-shell">
                <aside className="card dashboard-sidebar">
                    <p className="dashboard-brand">OptiGrid</p>
                    <NavLinks />
                </aside>
                <main className="dashboard-main">{children}</main>
            </div>
        </div>
    );
}