import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const CORE_BASE_URL = process.env.E2E_CORE_URL ?? "http://localhost:4000";

type E2EUser = {
  email: string;
  password: string;
  name: string;
  firstName: string;
  lastName: string;
};

function buildUniqueUser(): E2EUser {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `settings-e2e-${suffix}@optigrid.test`,
    password: "StrongPass123!",
    name: "Avery Settings",
    firstName: "Avery",
    lastName: "Settings",
  };
}

async function createUserInCore(request: APIRequestContext, user: E2EUser): Promise<void> {
  const response = await request.post(`${CORE_BASE_URL}/auth/signup`, {
    data: { email: user.email, password: user.password, name: user.name },
  });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `Signup failed: ${response.status()} ${JSON.stringify(payload)}`).toBeTruthy();
}

async function loginAndOpenSettings(page: Page, user: E2EUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);

  const loginResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname.endsWith("/api/auth/login")
  );
  await page.getByRole("button", { name: "Log in" }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.ok(), `Login failed with ${loginResponse.status()}`).toBeTruthy();
  await expect(page).toHaveURL(/\/_sessions\/[0-9a-f-]+\/dashboard$/, { timeout: 15_000 });

  const profileResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "GET" &&
    new URL(response.url()).pathname.endsWith("/api/auth/me")
  );
  await page.getByRole("link", { name: "Settings" }).click();
  const profileResponse = await profileResponsePromise;
  expect(profileResponse.ok(), `Profile request failed with ${profileResponse.status()}`).toBeTruthy();
  await expect(page).toHaveURL(/\/_sessions\/[0-9a-f-]+\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByLabel("Email Address")).toHaveValue(user.email);
}

async function createUserAndOpenSettings(
  page: Page,
  request: APIRequestContext
): Promise<E2EUser> {
  const user = buildUniqueUser();
  await createUserInCore(request, user);
  await loginAndOpenSettings(page, user);
  return user;
}

test.describe("Settings page", () => {
  test("loads the signed-in profile and role", async ({ page, request }) => {
    const user = await createUserAndOpenSettings(page, request);

    await expect(page.getByLabel("First Name")).toHaveValue(user.firstName);
    await expect(page.getByLabel("Last Name")).toHaveValue(user.lastName);
    await expect(page.getByLabel("Email Address")).toHaveValue(user.email);
    await expect(page.getByLabel("Role")).toBeDisabled();
    await expect(page.getByLabel("Role")).toHaveValue("User");
  });

  test("resets unsaved profile edits and acknowledges save actions", async ({ page, request }) => {
    const user = await createUserAndOpenSettings(page, request);

    await page.getByLabel("First Name").fill("Changed");
    await page.getByLabel("Last Name").fill("Profile");
    await page.getByRole("button", { name: "Reset" }).click();

    await expect(page.getByLabel("First Name")).toHaveValue(user.firstName);
    await expect(page.getByLabel("Last Name")).toHaveValue(user.lastName);
    await expect(page.getByText("Profile reset", { exact: true })).toBeVisible();

    await page.getByLabel("First Name").fill("Changed");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByLabel("First Name")).toHaveValue("Changed");
    await expect(page.getByText("Profile changes saved", { exact: true })).toBeVisible();
  });

  test("toggles the theme and persists the preference", async ({ page, request }) => {
    await createUserAndOpenSettings(page, request);

    const themeButton = page.getByRole("button", { name: /Switch to Dark Mode|Switch to Light Mode/ });
    const initialTheme = await page.locator("html").getAttribute("data-theme");
    expect(["light", "dark"]).toContain(initialTheme);
    const expectedTheme = initialTheme === "dark" ? "light" : "dark";

    const preferenceResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname.endsWith("/api/preferences/theme")
    );
    await themeButton.click();
    const preferenceResponse = await preferenceResponsePromise;

    expect(
      preferenceResponse.ok(),
      `Theme preference request failed with ${preferenceResponse.status()}`
    ).toBeTruthy();
    await expect(page.locator("html")).toHaveAttribute("data-theme", expectedTheme);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("optigrid-theme"))).toBe(expectedTheme);
  });

  test.skip("requires DELETE before showing the account-deletion confirmation", async ({ page, request }) => {
    const user = buildUniqueUser();
    await createUserInCore(request, user);
    await loginAndOpenSettings(page, user);

    const accountManagement = page.getByRole("heading", { name: "Account Management" }).locator("..");
    await accountManagement.getByRole("button", { name: "Delete Account" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/Type DELETE to confirm/).fill("delete");
    await page.getByRole("dialog").getByRole("button", { name: "Delete Account" }).click();
    await expect(page.getByText('Please type "DELETE" to confirm', { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/Type DELETE to confirm/).fill("DELETE");
    await page.getByRole("dialog").getByRole("button", { name: "Delete Account" }).click();
    await expect(page.getByText("Account deleted", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 });
  });
});
