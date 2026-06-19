import { expect, test, type APIRequestContext } from "@playwright/test";

const CORE_BASE_URL = process.env.E2E_CORE_URL ?? "http://localhost:4000";

type E2EUser = {
  email: string;
  password: string;
  name: string;
};

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildUniqueUser(): E2EUser {
  const suffix = uniqueSuffix();
  return {
    email: `create-building-e2e-${suffix}@optigrid.test`,
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

test.describe("Create building", () => {
  test("creates a building from the Add Building page", async ({
    page,
    request,
  }) => {
    const user = buildUniqueUser();
    const buildingName = `E2E Create Building ${uniqueSuffix()}`;
    const buildingAddress = "1 Maude St, Sandton, 2196";

    await createUserInCore(request, user);

    await page.goto("/login");
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("link", { name: "+ Add building" }).click();
    await expect(page).toHaveURL(/\/buildings\/add$/);

    await page.getByLabel(/Building name/).fill(buildingName);
    await page.getByLabel("Building type").selectOption("Commercial");
    await page.getByLabel("Physical address").fill(buildingAddress);
    await page.getByLabel(/Floor area/).fill("5000");
    await page.getByLabel("Max occupancy").fill("200");
    await page.getByLabel("Timezone").fill("Africa/Johannesburg");
    await page.getByRole("button", { name: "Add building" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("tbody").getByText(buildingName)).toBeVisible();
    await expect(page.locator("tbody").getByText(buildingAddress)).toBeVisible();
  });
});
