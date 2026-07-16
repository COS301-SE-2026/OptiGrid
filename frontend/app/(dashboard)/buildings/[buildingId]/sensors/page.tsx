import { parseSession, SESSION_COOKIE_NAME } from "../../../../../lib/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SensorsClient from "./sensors-client";

export default async function BuildingSensorsPage({
    params,
}: {
    params: Promise<{ buildingId: string }>;
}) 
{
    const sessionCookies = await cookies();
    const session = sessionCookies.get(SESSION_COOKIE_NAME);

    const user = parseSession(session?.value);
    if (!user) {
        redirect("/login");
    }
    const { buildingId } = await params;

    // viewing sensors is allowed for every role and z client component only uses the role to decide who can register or delete sensors
    return <SensorsClient role={user.roleType} buildingId={buildingId} />;
}