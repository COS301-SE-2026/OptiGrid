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
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Please fill in all fields")).toBeVisible();
  });

  test("shows API error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill("invalid@optigrid.test");
    await page.getByLabel("Password", { exact: true }).fill("BadPass123!");
    await page.getByRole("button", { name: "Log in" }).click();

    const resp = page.waitForResponse("**/api/auth/login");
    await page.getByRole("button", { name: "Log in"}).click();
    await resp;
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("routes to dashboard when login succeeds", async ({ page, request }) => {
    const user = buildUniqueUser();
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().toLowerCase().includes("hydrated")) {
        hydrationErrors.push(message.text());
      }
    });
    await createUserInCore(request, user);

    await page.goto("/login");
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    const loginResponsePromise = page.waitForResponse("**/api/auth/login");
    await page.getByRole("button", { name: "Log in" }).click();
    const loginResponse = await loginResponsePromise;
    const body = await loginResponse.json().catch(() => ({}));
    expect(loginResponse.ok(), `Login failed: ${loginResponse.status()} ${JSON.stringify(body)}`).toBeTruthy();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: `Welcome back, ${user.firstName}` })
    ).toBeVisible();
    expect(hydrationErrors).toEqual([]);
  });

  test("replaces stale root cookies when login succeeds", async ({ page, request }) => {
    const user = buildUniqueUser();
    const appOrigin = process.env.E2E_BASE_URL ?? "http://localhost:3000";
    await createUserInCore(request, user);

    await page.context().addCookies([
      {
        name: "optigrid_session",
        value: encodeURIComponent(JSON.stringify({ userId: "stale-user", email: "stale@example.com" })),
        url: appOrigin,
      },
      {
        name: "optigrid_access_token",
        value: "stale-token",
        url: appOrigin,
      },
    ]);

    await page.goto("/login");
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/_sessions\/[^/]+\/dashboard$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: `Welcome back, ${user.firstName}` })).toBeVisible();

    const rootCookies = (await page.context().cookies(appOrigin))
      .filter((cookie) => cookie.path === "/" && ["optigrid_session", "optigrid_access_token"].includes(cookie.name));
    expect(rootCookies).toEqual([]);
  });
});

test.describe("Login page before hydration", () => {
  test.use({ javaScriptEnabled: false });

  test("does not submit credentials through a native GET request", async ({ page }) => {
    await page.goto("/login");

    const form = page.locator("form");
    const submitButton = page.getByRole("button", { name: "Loading..." });

    await expect(form).toHaveAttribute("method", "post");
    await expect(submitButton).toBeDisabled();
    await expect(page.getByLabel("Work email")).toBeDisabled();
    await expect(page.getByLabel("Password", { exact: true })).toBeDisabled();
    await submitButton.click({ force: true });

    await expect(page).toHaveURL(/\/login$/);
    expect(new URL(page.url()).search).toBe("");
  });
});
