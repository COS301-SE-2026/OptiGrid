
import { expect, test } from "@playwright/test";

const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL;
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD;

test.describe("Anomaly Alerts", () => {
  test("manager can view anomaly alerts", async ({ page }) => {
    if (!MANAGER_EMAIL || !MANAGER_PASSWORD) {
      throw new Error(
        "E2E_MANAGER_EMAIL and E2E_MANAGER_PASSWORD are not loaded"
      );
    }

    await page.goto("/login");

    await page.getByLabel("Work email").fill(MANAGER_EMAIL);
    await page.getByLabel("Password").fill(MANAGER_PASSWORD);

    const loginResponse = page.waitForResponse("**/api/auth/login");

    await page.getByRole("button", { name: "Log in" }).click();

    expect((await loginResponse).ok()).toBeTruthy();

    await expect(page).toHaveURL(/\/dashboard$/, {
      timeout: 15_000,
    });

    await page.goto("/anomaly", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    await expect(
      page.getByRole("heading", { name: "Anomaly Alerts" })
    ).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText("Total Alerts")).toBeVisible();
    await expect(page.getByText("Open", { exact: true })).toBeVisible();
    await expect(page.getByText("Critical", { exact: true })).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Current Anomalies" })
    ).toBeVisible();

    await expect(
      page.locator("table.dashboard-table")
    ).toBeVisible();
  });
});
