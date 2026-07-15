import { cookies } from "next/headers";
import { parseSession, SESSION_COOKIE_NAME } from "../../../lib/session";
import { redirect } from "next/navigation";
import ManagerBuildings from "./manager-buildings";

export default async function ManagerPage() {
    const sessionCookies = await cookies();
    const session = sessionCookies.get(SESSION_COOKIE_NAME);
    const user = parseSession(session?.value);
    if (!user) {
        redirect("/login");
    }

    //here we make the page available only to thebuilding managers
    if (user.roleType !== "BUILDING_MANAGER") {
        redirect("/dashboard");
    }
    return <ManagerBuildings />;
}