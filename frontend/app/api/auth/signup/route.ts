import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://localhost:4000";
const SESSION_COOKIE_NAME = "optigrid_session";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type SignupBody = {
    email?: unknown;
    password?: unknown;
    name?: unknown;
    firstName?: unknown;
    lastName?: unknown;
};

function setAuthCookies(response: NextResponse, payload: Record<string, unknown>) {
    const maybeUser = payload.user as Record<string, unknown> | undefined;
    const userId = typeof maybeUser?.userId === "string" ? maybeUser.userId : "";
    const emailValue = typeof maybeUser?.email === "string" ? maybeUser.email : "";
    const firstName = typeof maybeUser?.firstName === "string" ? maybeUser.firstName : "";
    const lastName = typeof maybeUser?.lastName === "string" ? maybeUser.lastName : "";

    if (userId && emailValue) {
        response.cookies.set(
            SESSION_COOKIE_NAME,
            JSON.stringify({ userId, email: emailValue, firstName, lastName }),
            {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: SESSION_MAX_AGE_SECONDS,
            }
        );
    }

    const accessToken = typeof payload.accessToken === "string" ? payload.accessToken : "";
    if (accessToken) {
        response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: SESSION_MAX_AGE_SECONDS,
        });
    }
}

export async function POST(request: Request) {
    let body: SignupBody;

    try {
        body = (await request.json()) as SignupBody;
    } catch {
        return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const providedName = typeof body.name === "string" ? body.name.trim() : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const computedName = [firstName, lastName].filter(Boolean).join(" ");
    const name = providedName || computedName;

    if (!email || !password || !name) {
        return NextResponse.json(
            { message: "Email, password, and name are required fields." },
            { status: 400 }
        );
    }

    try {
        const coreResponse = await fetch(`${CORE_URL}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, name }),
            cache: "no-store",
        });

        const payload = (await coreResponse.json().catch(() => ({
            message: coreResponse.ok ? "User created successfully" : "Signup failed",
        }))) as Record<string, unknown>;

        if (!coreResponse.ok) {
            return NextResponse.json(payload, { status: coreResponse.status });
        }

        const loginResponse = await fetch(`${CORE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
            cache: "no-store",
        });
        const loginPayload = (await loginResponse.json().catch(() => payload)) as Record<string, unknown>;
        const responsePayload = loginResponse.ok ? loginPayload : payload;
        const responseStatus = loginResponse.ok ? coreResponse.status : 502;
        const response = NextResponse.json(responsePayload, { status: responseStatus });

        if (loginResponse.ok) {
            setAuthCookies(response, loginPayload);
        }

        return response;
    } catch {
        return NextResponse.json({ message: "Unable to reach authentication service." }, { status: 502 });
    }
}
