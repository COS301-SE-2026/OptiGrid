const CORE_URL = process.env.CORE_URL ?? "http://core:4000"; // NOSONAR

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ buildingId: string }> },
) {
  const { buildingId } = await context.params;

  try {
    const upstream = await fetch(
      `${CORE_URL}/api/telemetry/stream/${encodeURIComponent(buildingId)}`,
      {
        headers: {
          Accept: "text/event-stream",
        },
        cache: "no-store",
        signal: request.signal,
      },
    );

    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { status: "error", message: "Unable to open telemetry stream." },
        { status: upstream.status || 502 },
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
