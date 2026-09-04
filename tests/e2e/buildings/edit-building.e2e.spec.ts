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
  squareFootage: number;
  maxOccupancy: number;
};

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildUniqueUser(): E2EUser {
  const suffix = uniqueSuffix();
  return {
    email: `edit-building-e2e-${suffix}@optigrid.test`,
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
): Promise<string> {
  const response = await request.post(`${CORE_BASE_URL}/api/buildings`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Idempotency-Key": `edit-building-e2e-${uniqueSuffix()}`,
    },
    data: {
      building_name: building.name,
      building_type: "Commercial",
      square_footage: building.squareFootage,
      physical_address: building.address,
      timezone: "Africa/Johannesburg",
      max_occupancy: building.maxOccupancy,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    data?: {
      building_id?: unknown;
    };
  };
  expect(
    response.ok(),
    `Expected building seed to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`
  ).toBeTruthy();
  expect(typeof payload.data?.building_id).toBe("string");

  return payload.data?.building_id as string;
}

test.describe.skip("Edit building", () => {
  test("updates a building from the dashboard edit action", async ({
    page,
    request,
  }) => {
    const user = buildUniqueUser();
    const originalBuilding = {
      name: `E2E Edit Original ${uniqueSuffix()}`,
      address: "4 Maude St, Sandton, 2196",
      squareFootage: 5000,
      maxOccupancy: 200,
    };
    const updatedBuilding = {
      name: `E2E Edit Updated ${uniqueSuffix()}`,
      address: "5 Maude St, Sandton, 2196",
      squareFootage: "6500",
      maxOccupancy: "250",
      timezone: "Africa/Johannesburg",
    };

    await createUserInCore(request, user);
    await promoteE2EUser(user.email, "BUILDING_MANAGER");
    const accessToken = await loginInCore(request, user);
    await createBuildingInCore(request, accessToken, originalBuilding);

    await page.goto("/login");
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    const loginResponsePromise = page.waitForResponse("**/api/auth/login");
    await page.getByRole("button", { name: "Log in" }).click();
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.ok()).toBeTruthy();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
    const buildingsTable = page.getByRole("table", { name: "Your buildings" });
    const originalRow = buildingsTable.locator("tbody tr").filter({
      hasText: originalBuilding.name,
    });
    await expect(originalRow).toBeVisible();
      await originalRow
        .getByRole("link", { name: "Edit", exact: true })
        .click();

    await expect(page).toHaveURL(/\/buildings\/[^/]+\/edit$/);
    await expect(page.getByRole("heading", { name: "Edit Building" })).toBeVisible();
    await expect(page.getByLabel("Building name")).toHaveValue(originalBuilding.name);

    await page.getByLabel("Building name").fill(updatedBuilding.name);
    await page.getByLabel("Address").fill(updatedBuilding.address);
    await page.getByLabel("Square footage").fill(updatedBuilding.squareFootage);
    await page.getByLabel("Max occupancy").fill(updatedBuilding.maxOccupancy);
    await page.getByLabel("Timezone").fill(updatedBuilding.timezone);

    const updateResponsePromise = page.waitForResponse((response) => {
      return response.url().includes("/api/buildings/") && response.request().method() === "PATCH";
    });
    await page.getByRole("button", { name: "Save changes" }).click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.ok()).toBeTruthy();

    await expect(
      page.getByText("Building updated successfully. Redirecting...")
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

    const updatedRow = buildingsTable.locator("tbody tr").filter({
      hasText: updatedBuilding.name,
    });
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText(updatedBuilding.address);
    await expect(buildingsTable.locator("tbody")).not.toContainText(originalBuilding.name);
  });
});
