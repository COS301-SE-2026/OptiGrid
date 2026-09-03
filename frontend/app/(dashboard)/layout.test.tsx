import { render } from "@testing-library/react";
import DashboardLayout from "./layout";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { parseSession } from "../../lib/session";


//movks needed
jest.mock("next/navigation", () => ({redirect: jest.fn().mockImplementation(() => { throw new Error("NEXT_REDIRECT"); }),}));
jest.mock("next/headers", () => ({cookies: jest.fn(),}));
jest.mock("../../lib/session", () => ({
	buildDisplayName: jest.fn().mockReturnValue("Test User"),
	parseSession: jest.fn(),
	SESSION_COOKIE_NAME: "test-cookie",
}));
jest.mock("./nav-links", () => ({NavLinks: () => <div data-testid="nav-links">NavLinks</div>,}));
jest.mock("./logout-button", () => ({LogoutButton: () => <button data-testid="logout-button">Logout</button>,}));
jest.mock("../../components/AuditPageTracker", () => ({AuditPageTracker: () => <div data-testid="audit-tracker">Tracker</div>,}));

describe("DashboardLayout", () => {
	beforeEach(() => {jest.clearAllMocks();});

	it("should redirect to login", async () => {
		const mockCookies = {get: jest.fn().mockReturnValue(null),};
		(cookies as jest.Mock).mockResolvedValue(mockCookies);
		(parseSession as jest.Mock).mockReturnValue(null);
		await expect(DashboardLayout({ children: <div>Child</div> })).rejects.toThrow("NEXT_REDIRECT");
		expect(redirect).toHaveBeenCalledWith("/login");
	});

	it("should_render_layout", async () => {
		const mockCookies = {
			get: jest.fn().mockReturnValue({ value: "session-val" }),
		};
		(cookies as jest.Mock).mockResolvedValue(mockCookies);
		(parseSession as jest.Mock).mockReturnValue({
			firstName: "John",
			lastName: "Doe",
			email: "john@example.com",
			roleType: "ADMIN",
		});

		const comp = await DashboardLayout({ 
			children: <div data-testid="child">Child</div> 
		});
		const { getByTestId, getByText } = render(comp);
		expect(redirect).not.toHaveBeenCalled();
		expect(getByTestId("nav-links")).toBeInTheDocument();
		expect(getByTestId("logout-button")).toBeInTheDocument();
		expect(getByTestId("audit-tracker")).toBeInTheDocument();
		expect(getByTestId("child")).toBeInTheDocument();
		expect(getByText("JD")).toBeInTheDocument();
		expect(getByText("Test User")).toBeInTheDocument();
	});
});
