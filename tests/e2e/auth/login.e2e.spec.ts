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
    await page.getByPlaceholder("Email").fill("invalid@optigrid.test");
    await page.getByPlaceholder("Password").fill("BadPass123!");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("routes to dashboard when login succeeds", async ({ page, request }) => {
    const user = buildUniqueUser();
    await createUserInCore(request, user);

    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(user.email);
    await page.getByPlaceholder("Password").fill(user.password);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
