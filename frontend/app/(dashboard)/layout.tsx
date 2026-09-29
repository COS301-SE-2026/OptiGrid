import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NavLinks } from "./nav-links";
import { buildDisplayName, parseSession, SESSION_COOKIE_NAME, type SessionUser } from "../../lib/session";
import { humanise } from "../../lib/labels";
import { LogoutButton } from "./logout-button";
import { AuditPageTracker } from "../../components/AuditPageTracker";
import { OptiGridLogo } from "../../components/logo";

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
            <AuditPageTracker />
            <div className="dashboard-shell">
                <aside className="card dashboard-sidebar">
                    <Link
                        href="/dashboard"
                        aria-label="OptiGrid dashboard"
                        className="dashboard-brand"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            color: "var(--brand-ink)",
                            textDecoration: "none",
                            marginBottom: "var(--space-3)",
                        }}
                    >
                        <OptiGridLogo height={28} />
                    </Link>
                    <div className="dashboard-user">
                        <div className="dashboard-avatar">{initials}</div>
                        <div className="dashboard-user-text">
                            <span className="dashboard-user-name">{displayName}</span>
                            <span className="dashboard-user-role">{humanise(user.roleType, "Member")}</span>
                        </div>
                    </div>
                    <NavLinks role={user.roleType} />
                    <LogoutButton />
                </aside>
                <main className="dashboard-main">{children}</main>
            </div>
        </div>
    );
}