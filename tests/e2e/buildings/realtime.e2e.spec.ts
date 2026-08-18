import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const CORE_BASE_URL = process.env.E2E_CORE_URL ?? "http://localhost:4000";
const HARDWARE_API_KEY =
  process.env.E2E_HARDWARE_API_KEY ?? "optigrid-e2e-hardware-key";

type E2EUser = {
  email: string;
  password: string;
  name: string;
};

type TelemetryReading = {
  powerKw: number;
  voltageV: number;
  currentA: number;
};

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildUniqueUser(): E2EUser {
  return {
    email: `realtime-dashboard-e2e-${uniqueSuffix()}@optigrid.test`,
    password: "StrongPass123!",
    name: "Riley Realtime",
  };
}

async function createUserInCore(
  request: APIRequestContext,
  user: E2EUser,
): Promise<void> {
  const response = await request.post(`${CORE_BASE_URL}/auth/signup`, {
    data: user,
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
  buildingName: string,
): Promise<string> {
  const response = await request.post(`${CORE_BASE_URL}/api/buildings`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Idempotency-Key": `realtime-dashboard-e2e-${uniqueSuffix()}`,
    },
    data: {
      building_name: buildingName,
      building_type: "Commercial",
      square_footage: 5000,
      physical_address: "100 Innovation Way, Pretoria",
      timezone: "Africa/Johannesburg",
      max_occupancy: 200,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: { building_id?: unknown };
  };

  expect(
    response.ok(),
    `Expected building seed to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`,
  ).toBeTruthy();
  expect(typeof payload.data?.building_id).toBe("string");

  return payload.data?.building_id as string;
}

async function loginInFrontend(page: Page, user: E2EUser): Promise<string> {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);

  const loginResponsePromise = page.waitForResponse("**/api/auth/login");
  await page.getByRole("button", { name: "Log in" }).click();
  expect((await loginResponsePromise).ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/_sessions\/[0-9a-f-]+\/dashboard$/, {
    timeout: 15_000,
  });

  const sessionPrefix = new URL(page.url()).pathname.match(
    /^\/_sessions\/[0-9a-f-]+/,
  )?.[0];
  expect(sessionPrefix).toBeTruthy();

  return sessionPrefix as string;
}

async function ingestTelemetry(
  request: APIRequestContext,
  buildingId: string,
  reading: TelemetryReading,
): Promise<void> {
  const response = await request.post(`${CORE_BASE_URL}/api/telemetry/ingest`, {
    headers: {
      "x-sensor-key": HARDWARE_API_KEY,
    },
    data: {
      building_id: buildingId,
      sensor_id: `realtime-e2e-sensor-${buildingId}`,
      source_type: "EMULATOR",
      voltage_v: reading.voltageV,
      current_a: reading.currentA,
      power_kw: reading.powerKw,
      timestamp: new Date().toISOString(),
    },
  });
  const payload = await response.json().catch(() => ({}));

  expect(
    response.ok(),
    `Expected telemetry ingestion to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`,
  ).toBeTruthy();
}

test.describe("Real-time dashboard integration", () => {
  test.setTimeout(60_000);

  test("streams portfolio readings and carries the selected building into its live detail view", async ({
    page,
    request,
  }) => {
    const user = buildUniqueUser();
    const buildingName = `E2E Realtime Hub ${uniqueSuffix()}`;

    await createUserInCore(request, user);
    const accessToken = await loginInCore(request, user);
    const buildingId = await createBuildingInCore(
      request,
      accessToken,
      buildingName,
    );
    const sessionPrefix = await loginInFrontend(page, user);

    const portfolioStreamPromise = page.waitForRequest(
      (browserRequest) =>
        new URL(browserRequest.url()).pathname ===
        "/api/telemetry/stream/portfolio",
    );
    await page.goto(`${sessionPrefix}/realtime`);
    await portfolioStreamPromise;
    await expect(page.locator(".live-dot")).toHaveClass(/\bon\b/);

    const buildingCard = page.getByRole("link", {
      name: `View live telemetry for ${buildingName}`,
      exact: true,
    });
    await expect(buildingCard).toBeVisible({ timeout: 15_000 });
    await expect(buildingCard).toContainText("--");

    await ingestTelemetry(request, buildingId, {
      powerKw: 12.34,
      voltageV: 230.5,
      currentA: 53.6,
    });
    await expect(buildingCard).toContainText("12.34", { timeout: 10_000 });
    await expect(buildingCard).toContainText("Normal");

    const buildingStreamPromise = page.waitForRequest(
      (browserRequest) =>
        new URL(browserRequest.url()).pathname ===
        `/api/telemetry/stream/${buildingId}`,
    );
    await buildingCard.click();
    await expect(page).toHaveURL(
      new RegExp(`/buildings/${buildingId}/view$`),
    );
    await buildingStreamPromise;

    await expect(
      page.getByRole("heading", { name: "Real-Time Telemetry" }),
    ).toBeVisible();
    await expect(page.getByText("Online (Waiting for reading)")).toBeVisible();
    await expect(
      page.getByText("Live telemetry stream connected"),
    ).toBeVisible();

    await ingestTelemetry(request, buildingId, {
      powerKw: 18.75,
      voltageV: 231.5,
      currentA: 81.2,
    });
    await expect(page.getByText("Online (Streaming)")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("EMULATOR")).toBeVisible();
    await expect(
      page.getByText(`realtime-e2e-sensor-${buildingId}`),
    ).toBeVisible();
    await expect(page.getByText("18.75 kW")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("231.5 V")).toBeVisible();
    await expect(page.getByText("81.2 A")).toBeVisible();
    await expect(page.getByText(buildingName)).toBeVisible();
  });
});
