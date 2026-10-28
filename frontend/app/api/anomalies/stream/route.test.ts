/** @jest-environment node */

describe("anomaly stream route", () => {
  const originalCoreUrl = process.env.CORE_URL;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.CORE_URL = "http://core.test/";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env.CORE_URL = originalCoreUrl;
  });

  async function callGet(request: Request) {
    const { GET } = await import("./route");
    return GET(request);
  }

  it("passes the core anomaly stream through with the user's sign in", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: {\"event\":\"ANOMALY_DETECTED\"}\n\n"));
          controller.close();
        },
      }),
    });

    const request = new Request("http://localhost/api/anomalies/stream", {
      headers: { cookie: "optigrid_access_token=access-token" },
    });
    const response = await callGet(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
    expect(await response.text()).toBe("data: {\"event\":\"ANOMALY_DETECTED\"}\n\n");

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("http://core.test/api/anomalies/stream");
    expect(options.headers.Accept).toBe("text/event-stream");
    expect(options.headers.authorization).toBe("Bearer access-token");
    expect(options.cache).toBe("no-store");
  });

  it("returns the status of core when core refuses the stream", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, body: null });

    const response = await callGet(new Request("http://localhost/api/anomalies/stream"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      message: "Unable to open anomaly stream.",
    });
  });

  it("answers with 502 when core cannot be reached", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("connect ECONNREFUSED"));

    const response = await callGet(new Request("http://localhost/api/anomalies/stream"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      message: "Anomaly stream is unavailable.",
    });
  });
});