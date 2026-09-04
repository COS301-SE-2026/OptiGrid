import { parseSession, SESSION_COOKIE_NAME } from "../../../lib/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import InsightsClient from "./insights-client";

export default async function InsightsPage() {
    const sessionCookies = await cookies();
    const session = sessionCookies.get(SESSION_COOKIE_NAME);

    const user = parseSession(session?.value);
    if (!user) {
        redirect("/login");
    }

    // every role may read the recommendations and the client only uses the role to decide who can approve or dismiss one
    return <InsightsClient role={user.roleType} />;
}