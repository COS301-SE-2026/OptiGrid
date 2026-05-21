import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    try {
        const res = await fetch(`${CORE_URL}/buildings/${id}`, {
            headers: { "x-user-id": session.userId },
            cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json({ message: "Service unavailable" }, { status: 502 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
    }

    try {
        const res = await fetch(`${CORE_URL}/buildings/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "x-user-id": session.userId,
            },
            body: JSON.stringify(body),
            cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json({ message: "Service unavailable" }, { status: 502 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    try {
        const res = await fetch(`${CORE_URL}/buildings/${id}`, {
            method: "DELETE",
            headers: { "x-user-id": session.userId },
            cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch {
        return NextResponse.json({ message: "Service unavailable" }, { status: 502 });
    }
}