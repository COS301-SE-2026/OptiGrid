import { expect, test, type APIRequestContext } from "@playwright/test";

const CORE_BASE_URL = process.env.E2E_CORE_URL ?? "http://localhost:4000";

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedBuilding(
  request: APIRequestContext,
  accessToken: string,
  name: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const response = await request.post(`${CORE_BASE_URL}/api/buildings`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Idempotency-Key": `heatmap-render-e2e-${uniqueSuffix()}`,
    },
    data: {
      building_name: name,
      building_type: "Commercial",
      square_footage: 5000,
      physical_address: "1 Maude St, Sandton, 2196",
      timezone: "Africa/Johannesburg",
      max_occupancy: 200,
      latitude,
      longitude,
    },
  });

  const payload = await response.json().catch(() => ({}));
  expect(
    response.ok(),
    `Expected building seed to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`,
  ).toBeTruthy();
}

test("renders the energy heatmap without browser errors", async ({ page, request }) => {
  test.setTimeout(60_000);
  const suffix = uniqueSuffix();
  const user = {
    email: `heatmap-render-e2e-${suffix}@optigrid.test`,
    password: "StrongPass123!",
    name: "Heatmap Viewer",
  };
  const mapErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" && /maplibre|worker failed|webgl/i.test(message.text())) {
      mapErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/maplibre|worker failed|webgl/i.test(error.message)) {
      mapErrors.push(error.message);
    }
  });

  const signup = await request.post(`${CORE_BASE_URL}/auth/signup`, { data: user });
  expect(signup.ok(), await signup.text()).toBeTruthy();

  const login = await request.post(`${CORE_BASE_URL}/auth/login`, {
    data: { email: user.email, password: user.password },
  });
  const loginPayload = (await login.json()) as { accessToken?: string };
  expect(login.ok()).toBeTruthy();
  expect(loginPayload.accessToken).toBeTruthy();

  await seedBuilding(request, loginPayload.accessToken!, `Heatmap North ${suffix}`, -26.1076, 28.0567);
  await seedBuilding(request, loginPayload.accessToken!, `Heatmap South ${suffix}`, -26.2041, 28.0473);

  await page.goto("/login");
  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  const sessionPrefix = new URL(page.url()).pathname.replace(/\/dashboard$/, "");
  const workerResponsePromise = page.waitForResponse((response) => (
    new URL(response.url()).pathname === "/maplibre/maplibre-gl-worker.mjs"
  ));
  await page.goto(`${sessionPrefix}/heatmap`);
  expect((await workerResponsePromise).ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Energy heatmap" })).toBeVisible();
  await expect(page.locator(".heat-map-canvas")).toHaveAttribute("data-map-ready", "true", { timeout: 15_000 });
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  expect(mapErrors).toEqual([]);
});
