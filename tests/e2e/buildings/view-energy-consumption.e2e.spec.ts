import { expect, test, type APIRequestContext } from "@playwright/test";

const CORE_BASE_URL = process.env.E2E_CORE_URL ?? "http://localhost:4000";

type E2EUser = {
  email: string;
  password: string;
  name: string;
};

type BuildingSeed = {
  name: string;
  address: string;
};

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildUniqueUser(): E2EUser {
  const suffix = uniqueSuffix();
  return {
    email: `energy-consumption-e2e-${suffix}@optigrid.test`,
    password: "StrongPass123!",
    name: "Avery Energy",
  };
}

async function createUserInCore(
  request: APIRequestContext,
  user: E2EUser,
): Promise<void> {
  const response = await request.post(`${CORE_BASE_URL}/auth/signup`, {
    data: {
      email: user.email,
      password: user.password,
      name: user.name,
    },
  });

  const payload = await response.json().catch(() => ({}));
  expect(
    response.ok(),
    `Expected signup seed to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`,
  ).toBeTruthy();
}

async function loginInCore(
  request: APIRequestContext,
  user: E2EUser,
): Promise<string> {
  const response = await request.post(`${CORE_BASE_URL}/auth/login`, {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    accessToken?: unknown;
  };
  expect(
    response.ok(),
    `Expected login seed to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`,
  ).toBeTruthy();
  expect(typeof payload.accessToken).toBe("string");

  return payload.accessToken as string;
}

async function createBuildingInCore(
  request: APIRequestContext,
  accessToken: string,
  building: BuildingSeed,
): Promise<void> {
  const response = await request.post(`${CORE_BASE_URL}/api/buildings`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Idempotency-Key": `energy-consumption-e2e-${uniqueSuffix()}`,
    },
    data: {
      building_name: building.name,
      building_type: "Commercial",
      square_footage: 5000,
      physical_address: building.address,
      timezone: "Africa/Johannesburg",
      max_occupancy: 200,
    },
  });

  const payload = await response.json().catch(() => ({}));
  expect(
    response.ok(),
    `Expected building seed to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`,
  ).toBeTruthy();
}

test.describe("Building energy consumption", () => {
  test("shows energy consumption details and reloads them for a different time range", async ({
    page,
    request,
  }) => {
    const user = buildUniqueUser();
    const building = {
      name: `E2E Energy Building ${uniqueSuffix()}`,
      address: "8 Maude St, Sandton, 2196",
    };

    await createUserInCore(request, user);
    const accessToken = await loginInCore(request, user);
    await createBuildingInCore(request, accessToken, building);

    await page.route("**/api/buildings/*/energy-consumption*", async (route) => {
      const requestUrl = new URL(route.request().url());
      const timeRange = requestUrl.searchParams.get("time_range") ?? "30d";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "success",
          data: {
            time_range: timeRange,
            total_kwh: timeRange === "7d" ? 210 : 900,
            average_daily_kwh: timeRange === "7d" ? 30 : 30,
            total_cost_zar: timeRange === "7d" ? 420 : 1800,
            total_cost_usd: timeRange === "7d" ? 21 : 90,
            cost_per_kwh: 2,
            eui: timeRange === "7d" ? 0.04 : 0.18,
            total_anomaly_alerts: 0,
            cost_saved_by_recommendations_zar: null,
            peak_usage_times: [
              { timestamp: "2026-07-17T08:00:00.000Z", kwh: timeRange === "7d" ? 55 : 120 },
            ],
          },
        }),
      });
    });

    await page.goto("/login");
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    const buildingRow = page.locator("tbody tr").filter({ hasText: building.name });
    await expect(buildingRow).toBeVisible();
    await buildingRow.click();
    await expect(page).toHaveURL(/\/buildings\/[^/]+\/view$/);

    await expect(page.getByRole("heading", { name: "Energy Consumption" })).toBeVisible();
    await expect(page.getByText("900 kWh")).toBeVisible();
    await expect(page.getByText("R 1,800")).toBeVisible();
    await expect(page.getByText("120 kWh")).toBeVisible();

    await expect(page.getByText("120 kWh")).toBeVisible();
  });
});
