const mockGetAdminSystemHealth = jest.fn();

jest.mock("../../../backend/core/src/lib/prisma", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../../../backend/core/src/services/healthDashboard.service", () => ({
  getAdminSystemHealth: mockGetAdminSystemHealth,
}));

import express from "express";
import request from "supertest";
import systemHealthRoutes from "../../../backend/core/src/routes/systemHealth.routes";

const BUILDING_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const snapshot = {
  status: "healthy",
  generatedAt: "2026-08-23T12:00:00.000Z",
  application: { uptimeSeconds: 60 },
  filters: { buildingId: null, userId: null },
  dependencies: {},
  ingestion: {},
  failures: {},
};

type TestRole = Express.User["roleType"];
const ADMIN = "ADMIN" as TestRole;
const VIEWER = "VIEWER" as TestRole;

function createTestApp(role?: TestRole) {
  const app = express();
  app.use((req, _res, next) => {
    if (role) {
      req.user = {
        id: USER_ID,
        roleType: role,
        user_metadata: { tenant_id: "tenant-1" },
      };
    }
    next();
  });
  app.use("/api/admin/health", systemHealthRoutes);
  return app;
}

describe("admin system health route", () => {
  beforeEach(() => {
    mockGetAdminSystemHealth.mockResolvedValue(snapshot);
  });

  it("returns the dashboard to an administrator with default query options", async () => {
    const response = await request(createTestApp(ADMIN)).get("/api/admin/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(snapshot);
    expect(mockGetAdminSystemHealth).toHaveBeenCalledWith({
      windowMinutes: 15,
      failureLimit: 50,
      buildingId: undefined,
      userId: undefined,
    });
  });

  it("passes validated dashboard filters to the service", async () => {
    const response = await request(createTestApp(ADMIN))
      .get("/api/admin/health")
      .query({
        window_minutes: 30,
        failure_limit: 75,
        building_id: BUILDING_ID,
        user_id: USER_ID,
      });

    expect(response.status).toBe(200);
    expect(mockGetAdminSystemHealth).toHaveBeenCalledWith({
      windowMinutes: 30,
      failureLimit: 75,
      buildingId: BUILDING_ID,
      userId: USER_ID,
    });
  });

  it("rejects a request without an authenticated user", async () => {
    const response = await request(createTestApp()).get("/api/admin/health");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: "Unauthorised" });
    expect(mockGetAdminSystemHealth).not.toHaveBeenCalled();
  });

  it("rejects authenticated non-administrators", async () => {
    const response = await request(createTestApp(VIEWER)).get("/api/admin/health");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: "You do not have access to this",
    });
    expect(mockGetAdminSystemHealth).not.toHaveBeenCalled();
  });

  it.each([
    ["window_minutes", { window_minutes: 0 }],
    ["failure_limit", { failure_limit: 101 }],
    ["building_id", { building_id: "not-a-uuid" }],
    ["user_id", { user_id: "not-a-uuid" }],
  ])("rejects an invalid %s query value", async (_field, query) => {
    const response = await request(createTestApp(ADMIN))
      .get("/api/admin/health")
      .query(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: "error",
      message: "Invalid system health query parameters.",
    });
    expect(mockGetAdminSystemHealth).not.toHaveBeenCalled();
  });

  it("returns a sanitized server error when dashboard collection fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetAdminSystemHealth.mockRejectedValue(new Error("postgres://user:secret@database"));

    const response = await request(createTestApp(ADMIN)).get("/api/admin/health");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      status: "error",
      message: "Unable to retrieve system health.",
    });
    expect(JSON.stringify(response.body)).not.toContain("secret");
    consoleError.mockRestore();
  });
});
