import AuditClient from "./audit-client";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { parseSession, SESSION_COOKIE_NAME } from "../../../lib/session";

export default async function AuditPage() {
    const sessionCookies = await cookies();
    const sessionCookie = sessionCookies.get(SESSION_COOKIE_NAME);
    const user = parseSession(sessionCookie?.value);

    if (!user) {
        redirect("/login");
    }

    //only admins ae allowed to check audit logs cuz they expose whole system activity 
    if (user.roleType !== "ADMIN") {
        redirect("/dashboard");
    }
    return <AuditClient />;
}