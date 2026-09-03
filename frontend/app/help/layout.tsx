import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSession, SESSION_COOKIE_NAME } from "../../lib/session";

export default async function HelpLayout({ children }: Readonly<{ children: ReactNode }>) {
    const theCookies = await cookies();
    const sessionCookie = theCookies.get(SESSION_COOKIE_NAME);
    const user = parseSession(sessionCookie?.value);
    if (!user) {
        redirect("/login");
    }

    return <>{children}</>;
}