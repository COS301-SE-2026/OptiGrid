import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTabSessionPath, isTabSessionId, TAB_SESSION_HEADER } from "../../../../lib/tab-session";
import { clearUnscopedAuthCookies, setSessionCookie, setAccessTokenCookie, shouldUseSecureCookies } from "../../../../lib/authCookies";

const OAUTH_INTENT_COOKIE = "optigrid_oauth_intent";

function withIntentCleared(response: NextResponse) {
    response.cookies.set({ name: OAUTH_INTENT_COOKIE, value: "", path: "/", maxAge: 0 });
    return response;
}

type SessionUser = {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    roleType: string;
};

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "http";
    const actualOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : (process.env.NEXT_PUBLIC_SITE_URL || origin);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";
    const tabId = request.headers.get(TAB_SESSION_HEADER);
    const tabSessionId = isTabSessionId(tabId) ? tabId : null;

    if (code) {
        const cookie = await cookies();
        const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            cookies: {
                get(name: string) {
                    return cookie.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookie.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    cookie.set({ name, value: "", ...options });
                },
            },
        });
        
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data?.session && data?.user) {
            //here we get all the user details 
            const user = data.user;
            const email = user.email ?? "";
            const metadata = user.user_metadata || {};
            const fullName = typeof metadata.full_name === "string" ? metadata.full_name : "";
            const parts = fullName.split(" ");
            const firstName = typeof metadata.first_name === "string" ? metadata.first_name : (parts[0] || "");
            const lastName = typeof metadata.last_name === "string" ? metadata.last_name : (parts.slice(1).join(" ") || "");
            const url = process.env.CORE_URL ?? "http://localhost:4000";
            const recovering = cookie.get(OAUTH_INTENT_COOKIE)?.value === "recover";
            const respCore = await fetch(`${url}/auth/${recovering ? "oauth-recover" : "oauth-login"}`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({
                    access: data.session.access_token,
                    email,
                    firstName,
                    lastName,
                }),
            });
            if (!respCore.ok) {
                const failure = (await respCore.json().catch(() => ({}))) as { code?: string };
                let reason = "OAuthSyncFailed";
                if (recovering) {
                    reason = "OAuthRecoverFailed";
                } else if (respCore.status === 403 && failure.code === "ACCOUNT_DEACTIVATED") {
                    reason = "OAuthDeactivated";
                }
                return withIntentCleared(NextResponse.redirect(`${actualOrigin}/login?error=${reason}`));
            }

            const jsonData = await respCore.json();
            const resp = NextResponse.redirect(`${actualOrigin}${getTabSessionPath(next, tabSessionId)}`);
            const sessionUser: SessionUser = {
                userId: jsonData.user.userId,
                email: jsonData.user.email,
                firstName: jsonData.user.firstName,
                lastName: jsonData.user.lastName,
                roleType: jsonData.user.roleType,
            };

            const secure = shouldUseSecureCookies(request);
            setSessionCookie(resp, sessionUser, tabSessionId, secure);
            setAccessTokenCookie(resp, data.session.access_token, tabSessionId, secure);
            clearUnscopedAuthCookies(resp, tabSessionId, secure);
            return withIntentCleared(resp);
        }
    }
    return withIntentCleared(NextResponse.redirect(`${actualOrigin}/login?error=OAuthFailed`));
}
