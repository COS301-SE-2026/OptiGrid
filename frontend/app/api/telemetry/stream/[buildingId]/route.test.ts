/** @jest-environment node */

describe("telemetry stream [buildingId] route", () => {
  const originalCoreUrl = process.env.CORE_URL;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.CORE_URL = "http://core.test";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env.CORE_URL = originalCoreUrl;
  });

  async function callGet(buildingId: string, request?: Request) {
    const { GET } = await import("./route");

    return GET(
      request ??
        new Request(
          `http://localhost/api/telemetry/stream/${encodeURIComponent(buildingId)}`,
        ),
      { params: Promise.resolve({ buildingId }) },
    );
  }

  it("proxies a successful core telemetry stream response", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: {\"usage\":42}\n\n"));
        controller.close();
      },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    });

    const request = new Request("http://localhost/api/telemetry/stream/building-123", {
      signal: new AbortController().signal,
    });
    const response = await callGet("building-123", request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(response.headers.get("Connection")).toBe("keep-alive");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
    expect(await response.text()).toBe("data: {\"usage\":42}\n\n");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://core.test/api/telemetry/stream/building-123",
      {
        headers: {
          Accept: "text/event-stream",
        },
        cache: "no-store",
        signal: request.signal,
      },
    );
  });

  it("encodes the building id before forwarding to core", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream(),
    });

    await callGet("building with spaces/and/slashes");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://core.test/api/telemetry/stream/building%20with%20spaces%2Fand%2Fslashes",
      expect.any(Object),
    );
  });

  it("returns the upstream status when core rejects the stream", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      body: new ReadableStream(),
    });

    const response = await callGet("building-123");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      message: "Unable to open telemetry stream.",
    });
  });

  it("returns 502 when core returns no stream body", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    });

    const response = await callGet("building-123");

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      message: "Unable to open telemetry stream.",
    });
  });

  it("returns 502 when the telemetry stream request fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new TypeError("fetch failed"));

    const response = await callGet("building-123");

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      message: "Telemetry stream is unavailable.",
    });
  });
});
