import { expect, test, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'crypto';

const CORE_BASE_URL = process.env.E2E_CORE_URL ?? "http://localhost:4000";

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
    email: `esg-e2e-${suffix}@optigrid.test`,
    password: "StrongPass123!",
    name: "ESG Tester",
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

  if (!response.ok()) {
    console.error("Signup failed:", await response.json().catch(() => "No JSON"));
  }
  expect(response.ok()).toBeTruthy();
}

test.describe('ESG Scenario Builder', () => {

    test('should load baseline values and allow scenario simulation', async ({ page, request }) => {
        // 1. Setup user and login
        const user = buildUniqueUser();
        await createUserInCore(request, user);

        await page.goto("/login");
        await page.getByLabel("Work email").fill(user.email);
        await page.getByLabel("Password", { exact: true }).fill(user.password);
        const loginResponsePromise = page.waitForResponse("**/api/auth/login");
        await page.getByRole("button", { name: "Log in" }).click();
        const loginResponse = await loginResponsePromise;
        expect(loginResponse.ok()).toBeTruthy();

        await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

        // 2. Create building via UI
        const buildingName = `ESG E2E Building ${uniqueSuffix()}`;
        const buildingAddress = "1 Maude St, Sandton, 2196";
        await page.getByRole("link", { name: "+ Add building" }).click();
        await expect(page).toHaveURL(/\/buildings\/add$/);

        await page.getByLabel(/Building name/).fill(buildingName);
        await page.getByLabel("Building type").selectOption("Commercial");
        await page.getByLabel("Physical address").fill(buildingAddress);
        await page.getByLabel(/Floor area/).fill("20000");
        await page.getByLabel("Max occupancy").fill("250");
        await page.getByLabel("Timezone").fill("Africa/Johannesburg");
        await page.getByRole("button", { name: "Add building" }).click();

        await expect(page).toHaveURL(/\/dashboard$/);

        // 3. Navigate to the ESG dashboard for that building
        await page.goto(`/esg`);
        // Wait for the Living Environment to load
        await expect(page.getByRole('heading', { name: /Living Environment/i })).toBeVisible({ timeout: 15000 });

        // 4. Interact with sliders
        const resetBtn = page.getByRole('button', { name: /Reset to Baseline/i });
        await expect(resetBtn).toBeVisible();
        await expect(resetBtn).toBeDisabled();
        
        // Wait for Tree simulation rendering
        await expect(page.locator('text=Trees Eq')).toBeVisible();

        const energySlider = page.getByRole('slider', { name: 'Energy Efficiency' });
        
        await energySlider.focus();
        for (let i = 0; i < 10; i++) {
            await page.keyboard.press('ArrowRight');
        }

        // 5. Verify "Reset to Baseline" becomes enabled
        await expect(resetBtn).toBeEnabled({ timeout: 10000 });

        // 6. Click "Reset to Baseline"
        await resetBtn.click();

        // 7. Verify button becomes disabled again
        await expect(resetBtn).toBeDisabled();
    });
});
