import { expect, test, type APIRequestContext } from "@playwright/test";

const CORE_BASE_URL = process.env.E2E_CORE_URL ?? "http://localhost:4000";

type E2EUser = {
  email: string;
  password: string;
  name: string;
  firstName: string;
};

function buildUniqueUser(): E2EUser {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `login-e2e-${suffix}@optigrid.test`,
    password: "StrongPass123!",
    name: "Avery E2E",
    firstName: "Avery",
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
    `Expected signup to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`
  ).toBeTruthy();
}

test.describe("Login page", () => {
  test("shows validation error when required fields are missing", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.locator("form").evaluate((form) => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    await expect(page.getByText("Please fill in all fields")).toBeVisible();
  });

  test("shows API error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill("invalid@optigrid.test");
    await page.getByLabel("Password").fill("BadPass123!");
    await page.getByRole("button", { name: "Log in" }).click();

    const resp = page.waitForResponse("**/api/auth/login");
    await page.getByRole("button", { name: "Log in"}).click();
    await resp;
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("routes to dashboard when login succeeds", async ({ page, request }) => {
    const user = buildUniqueUser();
    await createUserInCore(request, user);

    await page.goto("/login");
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    const loginResponsePromise = page.waitForResponse("**/api/auth/login");
    await page.getByRole("button", { name: "Log in" }).click();
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.ok()).toBeTruthy();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: `Welcome back, ${user.firstName}` })
    ).toBeVisible();
  });
});
