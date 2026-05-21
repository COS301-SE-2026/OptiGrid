import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NavLinks } from "./nav-links";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const cookieStore = await cookies();
    const session = cookieStore.get("optigrid_session");
    if (!session?.value) {
        redirect("/login");
    }

    return (
        <div className="dashboard-page">
            <div className="dashboard-shell">
                <aside className="card dashboard-sidebar">
                    <p className="dashboard-brand">OptiGrid</p>
                    <NavLinks />
                    <form action="/api/auth/logout" method="post">
                        <button type="submit" className="btn btn-secondary w-full">
                            Logout
                        </button>
                    </form>
                </aside>
                <main className="dashboard-main">{children}</main>
            </div>
        </div>
    );
}
