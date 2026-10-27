import { readFile } from "node:fs/promises";
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

async function logIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);

  const loginResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname.endsWith("/api/auth/login")
  );
  await page.getByRole("button", { name: "Log in" }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.ok(), `Login failed with ${loginResponse.status()}`).toBeTruthy();
  await expect(page).toHaveURL(/\/_sessions\/[0-9a-f-]+\/dashboard$/, { timeout: 15_000 });
}

async function openSettings(page: Page, user: E2EUser): Promise<void> {
  const accountResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "GET" &&
    new URL(response.url()).pathname.endsWith("/api/accounts/me")
  );
  await page.getByRole("link", { name: "Settings" }).click();
  const accountResponse = await accountResponsePromise;
  expect(accountResponse.ok(), `Account request failed with ${accountResponse.status()}`).toBeTruthy();
  await expect(page).toHaveURL(/\/_sessions\/[0-9a-f-]+\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(user.email);
}

async function createUserAndOpenSettings(page: Page, request: APIRequestContext): Promise<E2EUser> {
  const user = buildUniqueUser();
  await createUserInCore(request, user);
  await logIn(page, user.email, user.password);
  await openSettings(page, user);
  return user;
}

function waitForApi(page: Page, method: string, path: string) {
  return page.waitForResponse((response) =>
    response.request().method() === method &&
    new URL(response.url()).pathname.endsWith(path)
  );
}

test.describe("Settings page", () => {
  test("loads the signed-in profile and role", async ({ page, request }) => {
    const user = await createUserAndOpenSettings(page, request);

    await expect(page.getByLabel("First name")).toHaveValue(user.firstName);
    await expect(page.getByLabel("Last name")).toHaveValue(user.lastName);
    await expect(page.getByLabel("Email address")).toBeDisabled();
    await expect(page.getByLabel("Role")).toBeDisabled();
    await expect(page.getByLabel("Role")).toHaveValue("User");
    await expect(page.getByText("Email and password", { exact: true })).toBeVisible();
  });

  test("discards edits and saves a new name that survives a reload", async ({ page, request }) => {
    const user = await createUserAndOpenSettings(page, request);

    await page.getByLabel("First name").fill("Changed");
    await page.getByLabel("Last name").fill("Profile");
    await expect(page.getByText("You have unsaved changes.")).toBeVisible();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(page.getByLabel("First name")).toHaveValue(user.firstName);
    await expect(page.getByLabel("Last name")).toHaveValue(user.lastName);

    await page.getByLabel("First name").fill("Jordan");
    const saveResponsePromise = waitForApi(page, "PUT", "/api/accounts/me");
    await page.getByRole("button", { name: "Save changes" }).click();
    expect((await saveResponsePromise).ok()).toBeTruthy();
    await expect(page.getByText("Profile saved", { exact: true })).toBeVisible();
    await expect(page.locator(".dashboard-user-name")).toHaveText(`Jordan ${user.lastName}`);

    await page.reload();
    await expect(page.getByLabel("First name")).toHaveValue("Jordan");
  });

  test("switches the theme and remembers the choice", async ({ page, request }) => {
    await createUserAndOpenSettings(page, request);

    const darkResponsePromise = waitForApi(page, "PUT", "/api/preferences/theme");
    await page.locator(".theme-option").filter({ hasText: "Dark" }).click();
    expect((await darkResponsePromise).ok()).toBeTruthy();
    await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("optigrid-theme"))).toBe("dark");

    const systemResponsePromise = waitForApi(page, "PUT", "/api/preferences/theme");
    await page.locator(".theme-option").filter({ hasText: "System" }).click();
    expect((await systemResponsePromise).ok()).toBeTruthy();
    await expect(page.getByRole("radio", { name: "System" })).toBeChecked();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("optigrid-theme"))).toBe("system");
    await expect(page.getByText(/Following your device/)).toBeVisible();
  });

  test("changes the password and logs in with the new one", async ({ page, request, browser }) => {
    const user = await createUserAndOpenSettings(page, request);
    const newPassword = "NewStrongPass456!";
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await logIn(otherPage, user.email, user.password);

    await page.getByRole("button", { name: "Change password" }).click();
    const form = page.getByRole("form", { name: "Change password" });
    await form.getByLabel("Current password").fill(user.password);
    await form.getByLabel("New password", { exact: true }).fill(newPassword);
    await form.getByLabel("Confirm new password").fill(newPassword);
    await expect(form.getByText("Strength: Strong")).toBeVisible();

    const changeResponsePromise = waitForApi(page, "POST", "/api/accounts/me/password");
    await form.getByRole("button", { name: "Update password" }).click();
    expect((await changeResponsePromise).ok()).toBeTruthy();
    await expect(page.getByText("Password updated. Your other devices were signed out.")).toBeVisible();

    const thisStatus = await page.evaluate(async () => (await fetch("/api/accounts/me", { cache: "no-store" })).status);
    expect(thisStatus).toBe(200);
    const otherStatus = await otherPage.evaluate(async () => (await fetch("/api/accounts/me", { cache: "no-store" })).status);
    expect(otherStatus).toBe(401);
    await otherContext.close();

    await logIn(page, user.email, newPassword);
  });

  test("rejects a wrong current password", async ({ page, request }) => {
    await createUserAndOpenSettings(page, request);

    await page.getByRole("button", { name: "Change password" }).click();
    const form = page.getByRole("form", { name: "Change password" });
    await form.getByLabel("Current password").fill("NotMyPassword1!");
    await form.getByLabel("New password", { exact: true }).fill("NewStrongPass456!");
    await form.getByLabel("Confirm new password").fill("NewStrongPass456!");
    await form.getByRole("button", { name: "Update password" }).click();

    await expect(form.getByText("Your current password is not correct.")).toBeVisible();
  });

  test("signs out every device", async ({ page, request, browser }) => {
    const user = await createUserAndOpenSettings(page, request);
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await logIn(otherPage, user.email, user.password);

    await page.getByRole("region", { name: "Security" }).getByRole("button", { name: "Sign out everywhere" }).click();
    const dialog = page.getByRole("dialog", { name: "Sign out of all devices?" });
    const signOutResponsePromise = waitForApi(page, "POST", "/api/accounts/me/sign-out-everywhere");
    await dialog.getByRole("button", { name: "Sign out everywhere" }).click();
    expect((await signOutResponsePromise).ok()).toBeTruthy();

    await expect(page).toHaveURL(/\/login\?signedOut=all$/, { timeout: 10_000 });
    await expect(page.getByText("You have been signed out on all your devices. Log in again to continue.")).toBeVisible();

    const otherStatus = await otherPage.evaluate(async () => (await fetch("/api/accounts/me", { cache: "no-store" })).status);
    expect(otherStatus).toBe(401);
    await otherContext.close();
  });

  test("downloads a copy of the user's data", async ({ page, request }) => {
    const user = await createUserAndOpenSettings(page, request);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download my data" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^optigrid-my-data-\d{4}-\d{2}-\d{2}\.json$/);
    const exported = JSON.parse(await readFile(await download.path(), "utf8"));
    expect(exported.account.email).toBe(user.email);
    expect(exported.activity.items.some((entry: { action: string }) => entry.action === "LOGIN")).toBeTruthy();
    await expect(page.getByText(`Saved as ${download.suggestedFilename()}`)).toBeVisible();
  });

  test("opens help and contact resources from settings", async ({ page, request }) => {
    await createUserAndOpenSettings(page, request);

    await page.getByRole("link", { name: "View Help" }).click();
    await expect(page).toHaveURL(/\/help$/, { timeout: 15000 });
    await expect(page.getByText("Quick access", { exact: true })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/_sessions\/[0-9a-f-]+\/settings$/);
    await page.getByRole("link", { name: "Contact", exact: true }).click();
    await expect(page).toHaveURL(/\/contact$/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Contact Us" })).toBeVisible();
  });

  test("goes back to the dashboard from the Help Centre logo without leaving the session", async ({ page, request }) => {
    await createUserAndOpenSettings(page, request);
    const sessionPrefix = new URL(page.url()).pathname.match(/^\/_sessions\/[0-9a-f-]+/)?.[0];

    await page.getByRole("link", { name: "View Help" }).click();
    await expect(page).toHaveURL(/\/help$/, { timeout: 15_000 });
    await page.getByRole("link", { name: "OptiGrid dashboard" }).click();

    await expect(page).toHaveURL(new RegExp(`${sessionPrefix}/dashboard$`), { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  });

  test("offers a signed in tab the dashboard on the landing page", async ({ page, request, browser }) => {
    await createUserAndOpenSettings(page, request);
    const sessionPrefix = new URL(page.url()).pathname.match(/^\/_sessions\/[0-9a-f-]+/)?.[0];

    await page.goto("/");
    const back = page.locator(".landing-nav").getByRole("link", { name: "Back to dashboard" });
    await expect(back).toBeVisible();
    await expect(page.locator(".landing-nav").getByRole("link", { name: "Log in" })).toHaveCount(0);
    await back.click();
    await expect(page).toHaveURL(new RegExp(`${sessionPrefix}/dashboard$`), { timeout: 15_000 });

    const visitorContext = await browser.newContext();
    const visitor = await visitorContext.newPage();
    const consoleErrors: string[] = [];
    visitor.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    const probe = visitor.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/api/auth/session"));
    await visitor.goto("/");
    expect((await probe).status()).toBe(204);
    await expect(visitor.locator(".landing-nav").getByRole("link", { name: "Log in" })).toBeVisible();
    expect(consoleErrors).toEqual([]);
    await visitorContext.close();
  });

  test("follows the device motion setting until the user overrides it", async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await createUserAndOpenSettings(page, request);
    const motion = page.getByRole("group", { name: "Motion" });
    const previewDot = page.locator(".motion-preview-dot");

    await expect(motion.getByRole("radio", { name: "Match device" })).toBeChecked();
    await expect(page.getByText("Your device asks for less motion. OptiGrid keeps animations off.")).toBeVisible();
    await expect(page.locator(".motion-preview-label")).toHaveText("Still");
    expect(await previewDot.evaluate((dot) => getComputedStyle(dot).animationName)).toBe("none");

    await motion.getByText("Full", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    await expect(page.locator(".motion-preview-label")).toHaveText("Moving");
    expect(await previewDot.evaluate((dot) => getComputedStyle(dot).animationName)).toBe("motion-preview-slide");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await motion.getByText("Reduce", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
    expect(await previewDot.evaluate((dot) => getComputedStyle(dot).animationName)).toBe("none");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
    await expect(page.getByRole("group", { name: "Motion" }).getByRole("radio", { name: "Reduce" })).toBeChecked();

    await page.getByRole("group", { name: "Motion" }).getByText("Match device", { exact: true }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-motion", /.+/);
  });

  test("pauses live updates everywhere and resumes them from the banner", async ({ page, request }) => {
    await createUserAndOpenSettings(page, request);
    const streamRequests: string[] = [];
    page.on("request", (sent) => {
      if (new URL(sent.url()).pathname.includes("/api/telemetry/stream/")) {
        streamRequests.push(sent.url());
      }
    });

    await page.getByRole("group", { name: "Live updates" }).getByText("Paused", { exact: true }).click();
    const banner = page.locator(".live-updates-notice");
    await expect(banner).toContainText("Live updates are paused on this device.");
    await expect(page.getByRole("row", { name: /Live readings/ })).toContainText("Paused");
    await expect(page.getByRole("row", { name: /Dashboard/ })).toContainText("Paused");

    await page.getByRole("link", { name: "Live", exact: true }).click();
    await expect(page).toHaveURL(/\/_sessions\/[0-9a-f-]+\/realtime$/);
    await expect(page.locator(".live-status-label")).toHaveText("Updates paused");
    await expect(banner).toBeVisible();
    await page.waitForTimeout(1500);
    expect(streamRequests).toHaveLength(0);

    await banner.getByRole("button", { name: "Resume live updates" }).click();
    await expect(banner).toBeHidden();
    await expect.poll(() => streamRequests.length).toBeGreaterThan(0);
    await expect(page.locator(".live-status-label")).not.toHaveText("Updates paused");
  });

  test("keeps the live stream closed on data saver", async ({ page, request }) => {
    await createUserAndOpenSettings(page, request);
    const streamRequests: string[] = [];
    page.on("request", (sent) => {
      if (new URL(sent.url()).pathname.includes("/api/telemetry/stream/")) {
        streamRequests.push(sent.url());
      }
    });

    await page.getByRole("group", { name: "Live updates" }).getByText("Data saver", { exact: true }).click();
    await expect(page.getByText("Live streams stay closed and pages check for new data less often.")).toBeVisible();
    await expect(page.getByRole("row", { name: /Live readings/ })).toContainText("Every 20 seconds");
    await expect(page.getByRole("row", { name: /Dashboard/ })).toContainText("Every 4 minutes");
    await expect(page.locator(".live-updates-notice")).toHaveCount(0);

    await page.getByRole("link", { name: "Live", exact: true }).click();
    await expect(page.locator(".live-status-label")).toHaveText("Data saver");
    await page.waitForTimeout(1500);
    expect(streamRequests).toHaveLength(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("optigrid-display-preferences") ?? "{}").liveUpdates)).toBe("saver");
  });

  test("remembers the 3D graphics choice on this device", async ({ page, request }) => {
    await createUserAndOpenSettings(page, request);
    const graphics = page.getByRole("group", { name: "3D graphics" });

    await expect(graphics.getByRole("radio", { name: "Auto" })).toBeChecked();
    await expect(page.getByText(/This screen has a pixel density of/)).toBeVisible();
    await graphics.getByText("Battery saver", { exact: true }).click();
    await expect(page.getByText(/Draws a still scene at a lower resolution/)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("group", { name: "3D graphics" }).getByRole("radio", { name: "Battery saver" })).toBeChecked();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("optigrid-display-preferences") ?? "{}").graphics)).toBe("saver");
  });

  test("applies the region format and clock across the app", async ({ page, request }) => {
    await createUserAndOpenSettings(page, request);
    const preview = page.locator(".format-preview");
    const expected = await page.evaluate(() => ({
      energy: new Intl.NumberFormat("en-ZA", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(12480.5),
      date: new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(2026, 9, 25, 14, 5)),
    }));

    await expect(preview).toContainText("14:05");
    await page.getByRole("group", { name: "Region format" }).getByText("South Africa", { exact: true }).click();
    await expect(preview).toContainText(`${expected.energy} kWh`);
    await expect(preview).toContainText(expected.date);
    await page.getByRole("group", { name: "Clock" }).getByText("12-hour", { exact: true }).click();
    await expect(preview).toContainText(/02:05\s?(PM|pm)/);

    await page.getByRole("group", { name: "Clock" }).getByText("24-hour", { exact: true }).click();
    await expect(page.getByText("Times show on a 24-hour clock everywhere.")).toBeVisible();

    await page.getByRole("link", { name: "Live", exact: true }).click();
    await expect(page.getByText(/Last updated \d{2}:\d{2}:\d{2}$/)).toBeVisible();

    await page.reload();
    await expect(page.getByText(/Last updated \d{2}:\d{2}:\d{2}$/)).toBeVisible();
  });

  test("logs out and prevents the tab session from being reused", async ({ page, request }) => {
    await createUserAndOpenSettings(page, request);
    const sessionPrefix = new URL(page.url()).pathname.match(/^\/_sessions\/[0-9a-f-]+/)?.[0];
    expect(sessionPrefix).toBeTruthy();

    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });
    const logoutResponsePromise = waitForApi(page, "POST", "/api/auth/logout");

    await page.getByRole("region", { name: "Account management" }).getByRole("button", { name: "Logout", exact: true }).click();
    const logoutResponse = await logoutResponsePromise;
    expect(logoutResponse.status()).toBeLessThan(400);
    await expect(page.getByText("Logged out", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login\?loggedOut=1$/, { timeout: 5_000 });

    await page.goto(`${sessionPrefix}/dashboard`);
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Settings page in a South African browser", () => {
  test.use({ locale: "en-ZA" });

  test("loads saved display choices without a hydration error", async ({ page, request }) => {
    const hydrationErrors: string[] = [];
    page.on("pageerror", (error) => {
      if (/hydrat/i.test(error.message)) hydrationErrors.push(error.message);
    });
    const user = buildUniqueUser();
    await createUserInCore(request, user);
    await page.goto("/login");
    await page.evaluate(
      (saved) => localStorage.setItem("optigrid-display-preferences", saved),
      JSON.stringify({ region: "za", clock: "12h", liveUpdates: "paused" }),
    );
    await logIn(page, user.email, user.password);
    await openSettings(page, user);

    await page.reload();
    await expect(page.locator(".format-preview")).toContainText(/02:05\s?pm/i);
    await expect(page.getByRole("group", { name: "Region format" }).getByRole("radio", { name: "South Africa" })).toBeChecked();
    await expect(page.locator(".live-updates-notice")).toBeVisible();

    await page.goto(page.url().replace(/settings$/, "compare"));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(hydrationErrors).toEqual([]);
  });
});
