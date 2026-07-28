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
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/_sessions\/[0-9a-f-]+\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/_sessions\/[0-9a-f-]+\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

test.describe("Settings page", () => {
  test("loads the signed-in profile, resets unsaved changes, and toggles the theme", async ({ page, request }) => {
    const user = buildUniqueUser();
    await createUserInCore(request, user);
    await loginAndOpenSettings(page, user);

    await expect(page.getByLabel("First Name")).toHaveValue(user.firstName);
    await expect(page.getByLabel("Last Name")).toHaveValue(user.lastName);
    await expect(page.getByLabel("Email Address")).toHaveValue(user.email);
    await expect(page.getByLabel("Role")).toBeDisabled();

    await page.getByLabel("First Name").fill("Changed");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("alert")).toHaveText("Profile changes saved");

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByLabel("First Name")).toHaveValue(user.firstName);
    await expect(page.getByRole("alert")).toHaveText("Profile reset");

    const themeButton = page.getByRole("button", { name: /Switch to Dark Mode|Switch to Light Mode/ });
    const initialThemeButtonText = await themeButton.innerText();
    await themeButton.click();
    await expect(themeButton).not.toHaveText(initialThemeButtonText);
  });

  test("requires DELETE before showing the account-deletion confirmation", async ({ page, request }) => {
    const user = buildUniqueUser();
    await createUserInCore(request, user);
    await loginAndOpenSettings(page, user);

    await page.getByRole("button", { name: "Delete Account" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/Type DELETE to confirm/).fill("delete");
    await page.getByRole("dialog").getByRole("button", { name: "Delete Account" }).click();
    await expect(page.getByRole("alert")).toHaveText('Please type "DELETE" to confirm');
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel(/Type DELETE to confirm/).fill("DELETE");
    await page.getByRole("dialog").getByRole("button", { name: "Delete Account" }).click();
    await expect(page.getByRole("alert")).toHaveText("Account deleted");
    await expect(page).toHaveURL(/\/login$/, { timeout: 5_000 });
  });
});
