/** @jest-environment node */

import { POST } from "./route";

//testing the api route becasue i dont think well have enough time to write e2e
describe("compare buildings route", () => {
  beforeEach(() => {
    //we set up a mock for backend 
    process.env.CORE_URL = "http://core.test";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "success",
        data: {
          buildingA: { building_id: "11111111-1111-1111-1111-111111111111" },
          buildingB: { building_id: "22222222-2222-2222-2222-222222222222" },
          mostEfficient: "22222222-2222-2222-2222-222222222222",
        },
      }),
    }) as jest.Mock;
  });

  it("forwards the request to core with auth and idempotency key", async () => {
    const request = new Request(
      "http://localhost/api/buildings/compare?building_id_a=11111111-1111-1111-1111-111111111111&building_id_b=22222222-2222-2222-2222-222222222222&time_range=30d",
      {
        method: "POST",
        headers: {
          cookie: "optigrid_session=%7B%22userId%22%3A%22user-123%22%7D; optigrid_access_token=test-token",
        },
      }
    );

    const response = await POST(request);
    const payload = await response.json();

    // we expect these things to be done
    expect(response.status).toBe(200);
    expect(payload.status).toBe("success");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://core.test/api/buildings/compare?building_id_a=11111111-1111-1111-1111-111111111111&building_id_b=22222222-2222-2222-2222-222222222222&time_range=30d",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          cookie: "optigrid_session=%7B%22userId%22%3A%22user-123%22%7D; optigrid_access_token=test-token",
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
          "Idempotency-Key": "compare-11111111-1111-1111-1111-111111111111-22222222-2222-2222-2222-222222222222-30d",
        }),
      })
    );
  });
});
