import { parseSession, SESSION_COOKIE_NAME } from "../../../lib/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import BillingClient from "./billing-client";

export default async function BillingPage() {
    const sessionCookies = await cookies();
    const session = sessionCookies.get(SESSION_COOKIE_NAME);

    const user = parseSession(session?.value);
    if (!user) {
        redirect("/login");
    }

    //the tariff rates affects every cost saving figure so only admins can change them
    if (user.roleType !== "ADMIN") {
        redirect("/dashboard");
    }

    return <BillingClient />;
}