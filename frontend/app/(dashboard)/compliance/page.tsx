import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSession, SESSION_COOKIE_NAME } from "../../../lib/session";
import ComplianceClient from "./compliance-client";

export default async function CompliancePage() {
    const sessionCookies = await cookies();
    const sessionCookie = sessionCookies.get(SESSION_COOKIE_NAME);
    const user = parseSession(sessionCookie?.value);
    if (!user) {
        redirect("/login");
    }
    return <ComplianceClient />;
}