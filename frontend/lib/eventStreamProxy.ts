import { getForwardHeaders } from "./coreProxy";

function upstreamHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { Accept: "text/event-stream" };
  const userAgent = request.headers.get("user-agent");
  if (userAgent) {
    headers["User-Agent"] = userAgent;
  }
  getForwardHeaders(request)?.forEach((value, name) => {
    headers[name] = value;
  });
  return headers;
}

// the browser only talks to this origin over HTTPS
export async function proxyEventStream(request: Request, corePath: string, streamName: string): Promise<Response> {
  const coreUrl = (process.env.CORE_URL ?? "http://core:4000").replace(/\/$/, ""); // NOSONAR
  const label = streamName.charAt(0).toUpperCase() + streamName.slice(1);

  try {
    const upstream = await fetch(`${coreUrl}${corePath}`, {
      headers: upstreamHeaders(request),
      cache: "no-store",
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { status: "error", message: `Unable to open ${streamName} stream.` },
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
      { status: "error", message: `${label} stream is unavailable.` },
      { status: 502 },
    );
  }
}