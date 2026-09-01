const mockGetHealth = jest.fn();
const mockInfluxDB = jest.fn();
const mockHealthAPI = jest.fn().mockImplementation(() => ({ getHealth: mockGetHealth }));

jest.mock("@influxdata/influxdb-client", () => ({
  InfluxDB: mockInfluxDB,
}));

jest.mock("@influxdata/influxdb-client-apis", () => ({
  HealthAPI: mockHealthAPI,
}));

import { createInfluxHealthClient } from "../../../backend/core/src/lib/influxHealth";

describe("createInfluxHealthClient", () => {
  const originalUrl = process.env.INFLUXDB_URL;
  const originalToken = process.env.INFLUXDB_TOKEN;

  beforeEach(() => {
    process.env.INFLUXDB_URL = "http://influx.test:8086";
    process.env.INFLUXDB_TOKEN = "test-token";
  });

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.INFLUXDB_URL;
    else process.env.INFLUXDB_URL = originalUrl;

    if (originalToken === undefined) delete process.env.INFLUXDB_TOKEN;
    else process.env.INFLUXDB_TOKEN = originalToken;
  });

  it("uses the configured InfluxDB connection and accepts a passing health response", async () => {
    mockGetHealth.mockResolvedValue({ name: "influxdb", status: "pass" });

    const client = createInfluxHealthClient();
    await expect(client.ping()).resolves.toBeUndefined();

    expect(mockInfluxDB).toHaveBeenCalledWith({
      url: "http://influx.test:8086",
      token: "test-token",
    });
    expect(mockHealthAPI).toHaveBeenCalledTimes(1);
    expect(mockGetHealth).toHaveBeenCalledTimes(1);
  });

  it("rejects a failing InfluxDB health response", async () => {
    mockGetHealth.mockResolvedValue({ name: "influxdb", status: "fail" });

    const client = createInfluxHealthClient();

    await expect(client.ping()).rejects.toThrow("InfluxDB health check failed");
  });
});
