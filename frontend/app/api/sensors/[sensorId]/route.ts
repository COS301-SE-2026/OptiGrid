import { NextResponse } from "next/server";
import { getForwardHeaders } from "@/lib/coreProxy";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000"; // NOSONAR

export async function DELETE(request: Request, { params }: { params: Promise<{ sensorId: string }> }) {
	const { sensorId } = await params;

	if (!sensorId) {
		return NextResponse.json({ message: "Sensor id is required." }, { status: 400 });
	}
	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}
	try {
		const coreResponse = await fetch(`${CORE_URL}/api/sensors/${sensorId}`, 
		{
			method: "DELETE",
			headers,
			cache: "no-store"
		});

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Sensor deleted successfully." : "Sensor deletion failed.",
		}));

		return NextResponse.json(payload, { status: coreResponse.status });
	} 
	catch {
		return NextResponse.json({ message: "Unable to reach sensor service." }, { status: 502 });
	}
}