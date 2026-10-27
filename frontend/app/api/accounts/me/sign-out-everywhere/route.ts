import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getCoreUrl, getForwardHeaders, hasTrustedMutationOrigin } from "@/lib/coreProxy";
import { clearAuthCookies, shouldUseSecureCookies } from "@/lib/authCookies";
import { isTabSessionId, TAB_SESSION_HEADER } from "@/lib/tab-session";

const SIGNED_OUT_EVERYWHERE_PATH = "/login?signedOut=all";

async function clearSupabaseCookies(response: NextResponse) {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseKey) {
		return;
	}

	try {
		const cookieStore = await cookies();
		const supabase = createServerClient(supabaseUrl, supabaseKey, {
			cookies: {
				get(name: string) {
					return cookieStore.get(name)?.value;
				},
				set(name: string, value: string, options: CookieOptions) {
					response.cookies.set({ name, value, ...options });
				},
				remove(name: string, options: CookieOptions) {
					response.cookies.set({ name, value: "", ...options });
				},
			},
		});
		await supabase.auth.signOut({ scope: "local" });
	}
	catch (error) {
		console.warn("Supabase cookie cleanup skipped:", error);
	}
}

export async function POST(request: Request) {
	if (!hasTrustedMutationOrigin(request)) {
		return NextResponse.json({ message: "Cross-origin request denied." }, { status: 403 });
	}

	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	let coreResponse: Response;
	try {
		coreResponse = await fetch(`${getCoreUrl()}/api/accounts/me/sign-out-everywhere`, {
			method: "POST",
			headers,
			cache: "no-store",
		});
	}
	catch {
		return NextResponse.json({ message: "Unable to reach the account service" }, { status: 502 });
	}

	if (!coreResponse.ok) {
		const failure = await coreResponse.json().catch(() => ({ message: "Unable to sign out of all devices" }));
		return NextResponse.json(failure, { status: coreResponse.status });
	}

	const response = NextResponse.json(
		{ message: "Signed out of all devices", redirectTo: SIGNED_OUT_EVERYWHERE_PATH },
		{ status: 200 },
	);
	const tabId = request.headers.get(TAB_SESSION_HEADER);
	clearAuthCookies(response, isTabSessionId(tabId) ? tabId : null, shouldUseSecureCookies(request));
	await clearSupabaseCookies(response);
	return response;
}