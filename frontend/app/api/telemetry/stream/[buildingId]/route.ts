import { proxyEventStream } from "@/lib/eventStreamProxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ buildingId: string }> },
) {
  const { buildingId } = await context.params;
  return proxyEventStream(request, `/api/telemetry/stream/${encodeURIComponent(buildingId)}`, "telemetry");
}
