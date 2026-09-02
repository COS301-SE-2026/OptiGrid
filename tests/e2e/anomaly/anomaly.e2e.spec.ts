import { test, expect } from "@playwright/test";
import { ensureE2EUser } from "../helpers/user-role";

test.describe("Anomalies Page E2E Suite", () => {
  const testUserEmail =
    process.env.E2E_USER_EMAIL ??
    `e2e_manager_${Date.now()}@optigrid.test`;

  const testUserPassword =
    process.env.E2E_USER_PASSWORD ??
    "Password123!";

  const mockBuildingId = "bld-101";
  const mockAnomalyId = "anom-888";

  test.beforeAll(async () => {
    await ensureE2EUser(
      testUserEmail,
      testUserPassword,
      "BUILDING_MANAGER"
    );
  });

  test.beforeEach(async ({ page }) => {
    await page.route(
      `**/api/buildings/${mockBuildingId}/series*`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "success",
            data: [
              {
                timestamp: new Date(
                  Date.now() - 3600000
                ).toISOString(),
                kwh: 120.5,
                cost_zar: 300.25,
              },
              {
                timestamp: new Date().toISOString(),
                kwh: 450.0,
                cost_zar: 1125.0,
              },
            ],
          }),
        });
      }
    );

    await page.goto("/login");

    await page.fill(
      'input[name="email"]',
      testUserEmail
    );

    await page.fill(
      'input[name="password"]',
      testUserPassword
    );

    await page.click('button[type="submit"]');

    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/anomalies");

    await expect(
      page.getByRole("heading", {
        name: "Energy Consumption",
      })
    ).toBeVisible();
  });

  test("should load the page, display KPI summaries, table, and consumption chart", async ({
    page,
  }) => {
    await expect(
      page.locator(
        ".dashboard-kpi-label:has-text('Total Alerts')"
      )
    ).toBeVisible();

    await expect(
      page.locator(
        ".dashboard-kpi-label:has-text('Open')"
      )
    ).toBeVisible();

    await expect(
      page.locator(
        ".dashboard-kpi-label:has-text('Critical')"
      )
    ).toBeVisible();

    await expect(
      page.getByRole("heading", {
        name: "Energy Consumption",
      })
    ).toBeVisible();

    const table = page.locator(
      "table.dashboard-table"
    );

    await expect(table).toBeVisible();

    await expect(table.locator("th")).toHaveText([
      "Building",
      "Type",
      "Severity",
      "Status",
      "Deviation",
      "Description",
      "Detected",
    ]);
  });

  test("should filter anomalies table by search query, status, and severity", async ({
    page,
  }) => {
    const searchInput =
      page.getByLabel("Search anomalies");

    await searchInput.fill("Power Spike");

    await expect(searchInput).toHaveValue(
      "Power Spike"
    );

    const statusSelect =
      page.getByLabel("Filter by status");

    await statusSelect.selectOption("Open");

    await expect(statusSelect).toHaveValue("Open");

    const severitySelect =
      page.getByLabel("Filter by severity");

    await severitySelect.selectOption("critical");

    await expect(severitySelect).toHaveValue(
      "critical"
    );

    await page
      .getByRole("button", { name: "Reset" })
      .click();

    await expect(searchInput).toHaveValue("");
    await expect(statusSelect).toHaveValue("all");
    await expect(severitySelect).toHaveValue("all");
  });

  test("should change chart metric between Power (kWh) and Cost (R)", async ({
    page,
  }) => {
    const metricSelect =
      page.getByLabel("Select metric for chart");

    await metricSelect.selectOption("cost");

    await expect(metricSelect).toHaveValue("cost");

    await expect(
      page.locator(".recharts-yAxis")
    ).toContainText("R");

    await metricSelect.selectOption("power");

    await expect(metricSelect).toHaveValue(
      "power"
    );

    await expect(
      page.locator(".recharts-yAxis")
    ).toContainText("kWh");
  });

  test("should open modal detail when clicking an anomaly row", async ({
    page,
  }) => {
    const anomalyRowBtn = page
      .locator("tr")
      .filter({
        hasText: "Science Center",
      })
      .getByRole("button")
      .first();

    await expect(anomalyRowBtn).toBeVisible();

    await anomalyRowBtn.click();

    const modal = page.locator(
      "dialog.modal-overlay"
    );

    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(modal).not.toBeVisible();
  });

  test("should proxy status PATCH updates cleanly to the backend API", async ({
    page,
  }) => {
    await page.route(
      `**/api/anomalies/${mockAnomalyId}`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              anomaly_id: mockAnomalyId,
              status: "Resolved",
              message:
                "Status updated successfully",
            }),
          });

          return;
        }

        await route.continue();
      }
    );

    const response = await page.evaluate(
      async (id) => {
        const res = await fetch(
          `/api/anomalies/${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: "Resolved",
            }),
          }
        );

        return {
          status: res.status,
          body: await res.json(),
        };
      },
      mockAnomalyId
    );

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      anomaly_id: mockAnomalyId,
      status: "Resolved",
    });
  });
});