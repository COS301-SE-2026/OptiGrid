import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSession, SESSION_COOKIE_NAME } from "../../../lib/session";
import HeatmapView from "@/components/heatmap/HeatmapView";

export default async function HeatmapPage() {
    const sessionCookies = await cookies();
    const user = parseSession(sessionCookies.get(SESSION_COOKIE_NAME)?.value);

    if (!user) {
        redirect("/login");
    }

    return (
        <Suspense fallback={null}>
            <HeatmapView role={user.roleType} />
        </Suspense>
    );
}