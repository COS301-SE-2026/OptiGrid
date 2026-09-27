import { getForwardHeaders } from "@/lib/coreProxy";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000"; // NOSONAR

export const dynamic = "force-dynamic";

function upstreamHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { Accept: "text/event-stream" };
  getForwardHeaders(request)?.forEach((value, name) => {
    headers[name] = value;
  });
  return headers;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ buildingId: string }> },
) {
  const { buildingId } = await context.params;

  try {
    const upstream = await fetch(
      `${CORE_URL}/api/telemetry/stream/${encodeURIComponent(buildingId)}`,
      {
        headers: upstreamHeaders(request),
        cache: "no-store",
        signal: request.signal,
      },
    );

    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { status: "error", message: "Unable to open telemetry stream." },
        { status: upstream.ok ? 502 : upstream.status || 502 },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json(
      { status: "error", message: "Telemetry stream is unavailable." },
      { status: 502 },
    );
  }
}
