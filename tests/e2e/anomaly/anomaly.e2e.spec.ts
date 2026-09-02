
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

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

function buildUniqueUser(): E2EUser {
  const suffix = uniqueSuffix();

  return {
    email: `anomaly-e2e-${suffix}@optigrid.test`,
    password: "StrongPass123!",
    name: "E2E Viewer",
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

async function login(page: Page, user: E2EUser): Promise<void> {
  await page.goto("/login");

  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);

  const loginResponsePromise = page.waitForResponse(
    "**/api/auth/login"
  );

  await page.getByRole("button", { name: "Log in" }).click();

  const loginResponse = await loginResponsePromise;

  expect(
    loginResponse.ok(),
    `Expected login to succeed, got ${loginResponse.status()}`
  ).toBeTruthy();
}

test.describe("Anomaly Alerts", () => {
  test("viewer can view anomaly alerts", async ({ page, request }) => {
    const user = buildUniqueUser();

    await createUser(request, user);
    await login(page, user);

    await page.goto("/useranomaly", {
      waitUntil: "commit",
      timeout: 60000,
    });

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

