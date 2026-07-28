import { test, expect } from "@playwright/test";

test.describe("OptiGrid Real-Time Dashboard E2E Tests", () => {
    test.beforeEach(async ({ page }) => {
        const uniqueEmail = `realtime_user_${Date.now()}_${Math.floor(Math.random() * 10000)}@example.com`;

        // sign up new user
        await page.goto("/signup");
        await page.locator('input[name="firstName"]').fill("Realtime");
        await page.locator('input[name="lastName"]').fill("Tester");
        await page.locator('input[name="email"]').fill(uniqueEmail);
        await page.locator('input[name="password"]').fill("SecurePassword123!");
        
        const confirmPasswordInput = page.locator('input[name="confirmPassword"]');
        if (await confirmPasswordInput.count() > 0) {
            await confirmPasswordInput.fill("SecurePassword123!");
        }

        await page.getByRole("button", { name: /create account|sign up/i }).click();
        await page.waitForURL(/\/(dashboard|realtime)$/, { timeout: 15_000 });

        // create building
        await page.goto("/buildings/add");
        await page.locator('input[name="buildingName"], input[name="building_name"]').fill("E2E Realtime Hub");
        await page.locator('input[name="physicalAddress"], input[name="physical_address"]').fill("100 Innovation Way");
        await page.getByRole("button", { name: /save|add|create/i }).click();
        await page.waitForURL(/\/(dashboard|buildings)$/, { timeout: 15_000 });

        // navigate to realtime dashboard
        await page.goto("/realtime");
    });

    test("renders header, title, and filter controls", async ({ page }) => {
        await expect(page.locator("h1.dashboard-title", { hasText: "Live readings" })).toBeVisible({ timeout: 10000 });
        await expect(page.locator("button.btn-secondary", { hasText: "Refresh" })).toBeVisible();
        await expect(page.locator("button.live-chip", { hasText: /All/ })).toBeVisible();
    });

    test("loads building records and populates active live telemetry metrics", async ({ page }) => {
        await expect(page.locator("h1.dashboard-title")).toBeVisible({ timeout: 10000 });
        const cardCount = await page.locator(".card").count();
        expect(cardCount).toBeGreaterThan(0);
    });

    test("supports manual refresh action without crashing", async ({ page }) => {
        const refreshButton = page.locator("button.btn-secondary", { hasText: "Refresh" });
        await expect(refreshButton).toBeVisible({ timeout: 10000 });
        await expect(refreshButton).toBeEnabled();
        
        await refreshButton.click();
        await expect(page.locator(".dashboard-subtitle")).toContainText(/Last updated/);
    });
});