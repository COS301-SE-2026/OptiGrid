import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000";

type SignupBody = {
    email?: unknown;
    password?: unknown;
    name?: unknown;
    firstName?: unknown;
    lastName?: unknown;
};

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

        const payload = await coreResponse.json().catch(() => ({
            message: coreResponse.ok ? "User created successfully" : "Signup failed",
        }));

        return NextResponse.json(payload, { status: coreResponse.status });
    } catch {
        return NextResponse.json({ message: "Unable to reach authentication service." }, { status: 502 });
    }
}
