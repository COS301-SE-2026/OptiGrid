import { expect, test, type APIRequestContext } from "@playwright/test";

const CORE_BASE_URL = process.env.E2E_CORE_URL ?? "http://localhost:4000";

type SignupUser = {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	name: string;
};

function buildUniqueUser(): SignupUser {
	const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const firstName = "Avery";
	const lastName = "Rivera";
	return {
		firstName,
		lastName,
		email: `signup-e2e-${suffix}@optigrid.test`,
		password: "StrongPass123!",
		name: `${firstName} ${lastName}`,
	};
}

async function createUserInCore(request: APIRequestContext, user: SignupUser): Promise<void> {
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
		`Expected signup seed to succeed, got ${response.status()} with payload ${JSON.stringify(payload)}`
	).toBeTruthy();
}

test.describe("Signup page", () => {
	test("shows validation errors for empty submit", async ({ page }) => {
		await page.goto("/signup");
		await page.getByRole("button", { name: "Create account" }).click();

		await expect(page.getByText("First name is required.")).toBeVisible();
		await expect(page.getByText("Email is required.")).toBeVisible();
		await expect(page.getByText("Password is required.")).toBeVisible();
	});

	test("creates account and routes to dashboard", async ({ page }) => {
		const user = buildUniqueUser();

		await page.goto("/signup");
		await page.getByLabel("First name").fill(user.firstName);
		await page.getByLabel("Last name").fill(user.lastName);
		await page.getByLabel("Work email").fill(user.email);
		await page.getByLabel("Password", { exact: true }).fill(user.password);
		await page.getByLabel("Confirm password", { exact: true }).fill(user.password);
		const signupResponsePromise = page.waitForResponse("**/api/auth/signup");
		await page.getByRole("button", { name: "Create account" }).click();
		const signupResponse = await signupResponsePromise;
		expect(signupResponse.ok()).toBeTruthy();

		await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
		await expect(
			page.getByRole("heading", { name: `Welcome back, ${user.firstName}` })
		).toBeVisible();
	});

	test("shows duplicate-user error returned by backend", async ({ page, request }) => {
		const user = buildUniqueUser();
		await createUserInCore(request, user);

		await page.goto("/signup");
		await page.getByLabel("First name").fill(user.firstName);
		await page.getByLabel("Last name").fill(user.lastName);
		await page.getByLabel("Work email").fill(user.email);
		await page.getByLabel("Password", { exact: true }).fill(user.password);
		await page.getByLabel("Confirm password", { exact: true }).fill(user.password);
		await page.getByRole("button", { name: "Create account" }).click();

		await expect(page.getByText("User already exists, please login instead.")).toBeVisible();
	});
});
