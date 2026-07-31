import { expect, test, type APIRequestContext } from "@playwright/test";
import { promoteE2EUser } from "../helpers/user-role";

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
    email: `delete-building-e2e-${suffix}@optigrid.test`,
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
      "Idempotency-Key": `delete-building-e2e-${uniqueSuffix()}`,
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

test.describe.skip("Delete building", () => {
  test("deletes a building from the dashboard delete action", async ({
    page,
    request,
  }) => {
    const user = buildUniqueUser();
    const building = {
      name: `E2E Delete Building ${uniqueSuffix()}`,
      address: "6 Maude St, Sandton, 2196",
    };

    await createUserInCore(request, user);
    await promoteE2EUser(user.email, "ADMIN");
    const accessToken = await loginInCore(request, user);
    await createBuildingInCore(request, accessToken, building);

    await page.goto("/login");
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    const loginResponsePromise = page.waitForResponse("**/api/auth/login");
    await page.getByRole("button", { name: "Log in" }).click();
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.ok()).toBeTruthy();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
    const buildingRow = page.locator("tbody tr").filter({
      hasText: building.name,
    });
    await expect(buildingRow).toBeVisible();
    await expect(buildingRow).toContainText(building.address);
    
    await buildingRow.hover();
    const deleteButton = buildingRow.getByRole("button", { name: "Delete", exact: true });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const deleteModal = page.locator(".modal");
    await expect(deleteModal.getByRole("heading", { name: "Delete building" })).toBeVisible();
    await expect(deleteModal.getByText(building.name)).toBeVisible();

    const deleteResponsePromise = page.waitForResponse((response) => {
      return response.url().includes("/api/buildings/") && response.request().method() === "DELETE";
    });
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.ok()).toBeTruthy();

    await expect(page.getByText("No buildings yet.")).toBeVisible();
    await expect(page.getByText(building.name)).toHaveCount(0);
  });
});
