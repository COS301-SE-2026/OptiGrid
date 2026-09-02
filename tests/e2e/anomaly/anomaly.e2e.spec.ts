
import { expect, test, type APIRequestContext } from "@playwright/test";

const CORE_BASE_URL =
  process.env.E2E_CORE_URL ?? "http://localhost:4000";

type E2EUser = {
  email: string;
  password: string;
  name: string;
};

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildUniqueUser(name: string): E2EUser {
  const suffix = uniqueSuffix();

  return {
    email: `anomaly-e2e-${suffix}@optigrid.test`,
    password: "StrongPass123!",
    name,
  };
}

async function createUser(
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
    `Expected signup to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`
  ).toBeTruthy();
}

async function login(page: any, user: E2EUser): Promise<void> {
  await page.goto("/login");

  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);

  const loginResponsePromise = page.waitForResponse(
    "**/api/auth/login"
  );

  await page.getByRole("button", { name: "Log in" }).click();

  const loginResponse = await loginResponsePromise;

  expect(loginResponse.ok()).toBeTruthy();
}

test.describe("Anomaly Alerts", () => {
  test("manager can view anomaly alerts", async ({ page, request }) => {
    const user = buildUniqueUser("E2E Manager");

    await createUser(request, user);
    await login(page, user);

    await page.goto("/anomaly");

    await expect(
      page.getByRole("heading", { name: "Anomaly Alerts" })
    ).toBeVisible();

    await expect(page.getByText("Total Alerts")).toBeVisible();
    await expect(page.getByText("Open", { exact: true })).toBeVisible();
    await expect(page.getByText("Critical", { exact: true })).toBeVisible();
    await expect(page.getByText("Buildings", { exact: true })).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Current Anomalies" })
    ).toBeVisible();

    await expect(
      page.locator("table.dashboard-table")
    ).toBeVisible();
  });

  test("viewer can view anomaly alerts", async ({ page, request }) => {
    const user = buildUniqueUser("E2E Viewer");

    await createUser(request, user);
    await login(page, user);

    await page.goto("/useranomaly");

    await expect(
      page.getByRole("heading", { name: "Anomaly Alerts" })
    ).toBeVisible();

    await expect(
      page.locator("table.dashboard-table")
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Configure Threshold/ })
    ).toHaveCount(0);
  });
});

