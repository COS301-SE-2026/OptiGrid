import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import {isTabSessionId, TAB_SESSION_HEADER } from "../../../../lib/tab-session";
import { setSessionCookie, setAccessTokenCookie } from "../../../../lib/authCookies";

type SessionUser = {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    roleType: string;
};

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
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
            const resp = NextResponse.redirect(`${origin}${next}`);
            const user = data.user;
            const email = user.email ?? "";
            const metadata = user.user_metadata || {};
            const fullName = typeof metadata.full_name === "string" ? metadata.full_name : "";
            const parts = fullName.split(" ");
            const firstName = typeof metadata.first_name === "string" ? metadata.first_name : (parts[0] || "");
            const lastName = typeof metadata.last_name === "string" ? metadata.last_name : (parts.slice(1).join(" ") || "");
            const sessionUser: SessionUser = {
                userId: user.id,
                email: email,
                firstName: firstName,
                lastName: lastName,
                roleType: "VIEWER",
            };

            setSessionCookie(resp, sessionUser, tabSessionId);
            setAccessTokenCookie(resp, data.session.access_token, tabSessionId);
            return resp;
        }
    }
    return NextResponse.redirect(`${origin}/login?error=OAuthFailed`);
}
