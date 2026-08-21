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

function buildUniqueUser(prefix: string): E2EUser {
  const suffix = uniqueSuffix();
  return {
    email: `${prefix}-${suffix}@optigrid.test`,
    password: "StrongPass123!",
    name: "Avery Building",
  };
}

async function createUserInCore(
  request: APIRequestContext,
  user: E2EUser
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
    `Expected signup seed to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`
  ).toBeTruthy();
}

async function loginInCore(
  request: APIRequestContext,
  user: E2EUser
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
    `Expected login seed to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`
  ).toBeTruthy();
  expect(typeof payload.accessToken).toBe("string");

  return payload.accessToken as string;
}

async function createBuildingInCore(
  request: APIRequestContext,
  accessToken: string,
  building: BuildingSeed
): Promise<void> {
  const response = await request.post(`${CORE_BASE_URL}/api/buildings`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Idempotency-Key": `list-building-e2e-${uniqueSuffix()}`,
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
    `Expected building seed to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`
  ).toBeTruthy();
}

test.describe("List buildings", () => {
  test("shows only the authenticated user's buildings on the dashboard", async ({
    page,
    request,
  }) => {
    const owner = buildUniqueUser("list-building-owner-e2e");
    const otherUser = buildUniqueUser("list-building-other-e2e");
    const visibleBuilding = {
      name: `E2E Listed Building ${uniqueSuffix()}`,
      address: "2 Maude St, Sandton, 2196",
    };
    const hiddenBuilding = {
      name: `E2E Hidden Building ${uniqueSuffix()}`,
      address: "3 Maude St, Sandton, 2196",
    };

    await createUserInCore(request, owner);
    await createUserInCore(request, otherUser);

    const ownerAccessToken = await loginInCore(request, owner);
    const otherAccessToken = await loginInCore(request, otherUser);

    await createBuildingInCore(request, ownerAccessToken, visibleBuilding);
    await createBuildingInCore(request, otherAccessToken, hiddenBuilding);

    await page.goto("/login");
    await page.getByLabel("Work email").fill(owner.email);
    await page.getByLabel("Password").fill(owner.password);
    const loginResponsePromise = page.waitForResponse("**/api/auth/login");
    await page.getByRole("button", { name: "Log in" }).click();
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.ok()).toBeTruthy();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    const buildingsTable = page.getByRole("table", { name: "Your buildings" });
    const visibleRow = buildingsTable.locator("tbody tr").filter({
      hasText: visibleBuilding.name,
    });
    await expect(visibleRow).toBeVisible();
    await expect(visibleRow).toContainText("Commercial");
    await expect(visibleRow).toContainText(visibleBuilding.address);
    await expect(buildingsTable.locator("tbody")).not.toContainText(hiddenBuilding.name);
    await expect(page.getByText("No buildings yet.")).toHaveCount(0);
  });
});
