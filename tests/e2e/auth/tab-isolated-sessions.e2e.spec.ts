import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const CORE_BASE_URL = process.env.E2E_CORE_URL ?? "http://localhost:4000";

type E2EUser = {
  email: string;
  password: string;
  name: string;
  firstName: string;
};

function buildUniqueUser(firstName: string): E2EUser {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `tab-session-${firstName.toLowerCase()}-${suffix}@optigrid.test`,
    password: "StrongPass123!",
    name: `${firstName} E2E`,
    firstName,
  };
}

async function createUserInCore(request: APIRequestContext, user: E2EUser): Promise<void> {
  const response = await request.post(`${CORE_BASE_URL}/auth/signup`, {
    data: { email: user.email, password: user.password, name: user.name },
  });

  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `Signup failed: ${response.status()} ${JSON.stringify(payload)}`).toBeTruthy();
}

async function login(page: Page, user: E2EUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/_sessions\/[0-9a-f-]+\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: `Welcome back, ${user.firstName}` })).toBeVisible();
}

test.describe("Tab-isolated authentication sessions", () => {
  test("keeps two logged-in users independent in separate tabs of one browser", async ({ browser, request }) => {
    const arti = buildUniqueUser("Arti");
    const teammate = buildUniqueUser("Nandi");
    await createUserInCore(request, arti);
    await createUserInCore(request, teammate);

    const context = await browser.newContext();
    const artiTab = await context.newPage();
    const teammateTab = await context.newPage();

    try {
      await login(artiTab, arti);
      const artiDashboardUrl = artiTab.url();

      await login(teammateTab, teammate);
      const teammateDashboardUrl = teammateTab.url();

      expect(artiDashboardUrl).not.toBe(teammateDashboardUrl);
      await artiTab.reload();
      await expect(artiTab.getByRole("heading", { name: `Welcome back, ${arti.firstName}` })).toBeVisible();
      await expect(artiTab.getByRole("complementary").locator(".dashboard-user")).toContainText(arti.firstName);

      await teammateTab.reload();
      await expect(teammateTab.getByRole("heading", { name: `Welcome back, ${teammate.firstName}` })).toBeVisible();
      await expect(teammateTab.getByRole("complementary").locator(".dashboard-user")).toContainText(teammate.firstName);

      const artiSession = await artiTab.evaluate(async () => {
        const response = await fetch("/api/auth/me");
        return response.json();
      });
      const teammateSession = await teammateTab.evaluate(async () => {
        const response = await fetch("/api/auth/me");
        return response.json();
      });

      expect(artiSession.email).toBe(arti.email);
      expect(teammateSession.email).toBe(teammate.email);

      await teammateTab.getByRole("button", { name: "Logout" }).click();
      await expect(teammateTab).toHaveURL(/\/login\?loggedOut=1$/);

      await artiTab.reload();
      await expect(artiTab.getByRole("heading", { name: `Welcome back, ${arti.firstName}` })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
