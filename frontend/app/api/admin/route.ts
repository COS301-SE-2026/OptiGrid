import { NextResponse } from "next/server";
import { getForwardHeaders, ForwardHeaderOptions, readCookieValue } from "../buildings/[buildingId]/route"

const CORE_URL = process.env.CORE_URL ?? "http://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";


export async function GET(req: Request) {
    const headers = getForwardHeaders(req);
    if(!headers) {
        return NextResponse.json({
            message: "Authentication required."
        },
        {
            status: 401
        });
    }
    const {searchParams} = new URL(req.url);
    const state= searchParams.get("lifecycle_state");
    const url = state ? `${CORE_URL}/api/admin?lifecycle_state=${state}` : `${CORE_URL}/api/admin`;

    try {
        const resp = await fetch(url, {
            method: "GET",
            headers,
            cache: "no-store",
        });

        const payload = await resp.json().catch(()=> ({
            message: resp.ok ? "Builiding created successfully" : "Building failed",
        }));
        return NextResponse.json(payload, {
            status: resp.status
        });
    }
    catch {
        return NextResponse.json({
            message: "Internal Servor error, unable to reach service"
        },
        {
            status: 502
        });
    }
}