import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NavLinks } from "./nav-links";
import { buildDisplayName, parseSession, SESSION_COOKIE_NAME, type SessionUser } from "../../lib/session";
import Link from "next/link";

function getInitials(user: SessionUser): string {
    const first = user.firstName?.[0] ?? "";
    const last = user.lastName?.[0] ?? "";
    const initials = `${first}${last}`.toUpperCase();
    if (initials.length > 0) {
        return initials;
    }

    return user.email.slice(0, 2).toUpperCase();
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE_NAME);
    const user = parseSession(session?.value);

    if (!user) {
        redirect("/login");
    }

    const displayName = buildDisplayName(user);
    const initials = getInitials(user);

    return (
        <div className="dashboard-page">
            <div className="dashboard-shell">
                <aside className="card dashboard-sidebar">
                    <p className="dashboard-brand">OptiGrid</p>
                    <div className="dashboard-user" style={{ marginTop: "12px" }}>
                        <div className="dashboard-avatar">{initials}</div>
                        <span>{displayName}</span>
                    </div>
                    <NavLinks role={user.roleType} />
                    <div className="dashboard-utility">
                        <Link href="/help" className="dashboard-link">Help Centre</Link>
                        <Link href="/contact" className="dashboard-link">Contact Us</Link>
                    </div>
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