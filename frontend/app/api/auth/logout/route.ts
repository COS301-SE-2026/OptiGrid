import { NextResponse } from "next/server";
import { getTabSessionCookiePath, isTabSessionId, TAB_SESSION_HEADER } from "../../../../lib/tab-session";
import { getCoreUrl, getForwardHeaders } from "@/lib/coreProxy";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "optigrid_session";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const LOGOUT_REDIRECT_PATH = "/login?loggedOut=1";

async function buildLogoutResponse(request: Request) {
	const requestedTabSessionId = request.headers.get(TAB_SESSION_HEADER);
	const tabSessionId = isTabSessionId(requestedTabSessionId) ? requestedTabSessionId : null;
	const response = new NextResponse(null, { status: 303 });
	response.headers.set("Location", LOGOUT_REDIRECT_PATH);

	const buildDeleteCookieString = (name: string, path: string) => {
		const secureStr = process.env.NODE_ENV === "production" ? "; Secure" : "";
		return `${name}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Lax${secureStr}`;
	};
	response.headers.append("Set-Cookie", buildDeleteCookieString(SESSION_COOKIE_NAME, "/"));
	response.headers.append("Set-Cookie", buildDeleteCookieString(ACCESS_TOKEN_COOKIE_NAME, "/"));
	if (tabSessionId) {
		const tabPath = getTabSessionCookiePath(tabSessionId);
		response.headers.append("Set-Cookie", buildDeleteCookieString(SESSION_COOKIE_NAME, tabPath));
		response.headers.append("Set-Cookie", buildDeleteCookieString(ACCESS_TOKEN_COOKIE_NAME, tabPath));
	}
	const cookieStore = await cookies();
	const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
			cookies: {
				get(name: string) {
					return cookieStore.get(name)?.value;
				},
				set(name: string, value: string, options: CookieOptions) {
					response.cookies.set({ 
						name, 
						value, 
						...options 
					});
				},
				remove(name: string, options: CookieOptions){
					response.cookies.set({ 
						name, 
						value: "", 
						...options 
					});
				},
			},
		}
	);
	await supabase.auth.signOut();

	return response;
}

//  signing out must work even when the audit service cannot be reached
async function recordLogout(request: Request) {
	try {
		const headers = getForwardHeaders(request);
		if (!headers) {
			return;
		}

		headers.set("Content-Type", "application/json");
		await fetch(`${getCoreUrl()}/auth/logout`, {
			method: "POST",
			headers,
			cache: "no-store"
		});
	}
	catch {
		return;
	}
}

export async function GET(request: Request) {
	await recordLogout(request);
	return await buildLogoutResponse(request);
}

export async function POST(request: Request) {
	await recordLogout(request);
	return await buildLogoutResponse(request);
}
