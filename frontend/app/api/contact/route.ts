import { NextResponse } from "next/server";

const getUrl = () => process.env.CORE_URL ?? "http://core:4000";

//create the idempotency key for our controller to confirm
function createKey() : string {
    let key: string;
    if(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") 
        key= crypto.randomUUID();//random key from crypto library
    else key = `${Date.now()}-${Math.random()}`;//if crypto bugs then we return it old way
    //works by returning ms from 1 Jan 1970  n a radom no, from math library
    return `contact-${key}`;
}

export async function POST(req:Request) {
    const auth = req.headers.get("authorization");
    const cookie = req.headers.get('cookie');

    let body: Record<string, unknown>;
    try {
        body = (await req.json()) as Record<string, unknown>;

    }
    catch{
        return NextResponse.json({
            message: "Invalid request body"
            },{
            status: 400
        });
    }

    //here we send the request to frontend to process
    try {
        const resp = await fetch(`${getUrl()}/api/contact`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": req.headers.get("idempotency-key")?.trim() || createKey(),
                ...(auth ? {Authorization: auth } : {}),
                ...(cookie ? {Cookie: cookie} : {}),
            },
            body: JSON.stringify(body),
            cache: "no-store",
        });

        const load = await resp.json().catch(() => ({message: resp.ok ? "Ticket sent succesfully" : "Ticket not send, failed",}));

        return NextResponse.json(load, {
            status: resp.status
        });
    }
    catch {
        return NextResponse.json(
            { message: "Unable to reach service"},
            { status: 502}
        );
    }
}