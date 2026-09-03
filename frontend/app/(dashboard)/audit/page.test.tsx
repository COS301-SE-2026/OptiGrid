import { render, screen } from "@testing-library/react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSession } from "../../../lib/session";
import AuditPage from "./page";

jest.mock("next/headers", () => ({
    cookies: jest.fn(),
}));

jest.mock("next/navigation", () => ({
    redirect: jest.fn((path: string) => {
        throw new Error(`redirect:${path}`);
    }),
}));

jest.mock("../../../lib/session", () => ({
    SESSION_COOKIE_NAME: "optigrid_session",
    parseSession: jest.fn(),
}));

jest.mock("./audit-client", () => ({
    __esModule: true,
    default: () => <div>Audit client</div>,
}));

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockParseSession = parseSession as jest.MockedFunction<typeof parseSession>;

describe("AuditPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCookies.mockResolvedValue({
            get: jest.fn().mockReturnValue({ value: "session" }),
        } as never);
    });

    it.each(["ADMIN", "BUILDING_MANAGER"])("allows %s users", async (roleType) => {
        mockParseSession.mockReturnValue({
            userId: "user-1",
            email: "user@optigrid.test",
            firstName: "Test",
            lastName: "User",
            roleType,
        });

        render(await AuditPage());

        expect(screen.getByText("Audit client")).toBeInTheDocument();
        expect(redirect).not.toHaveBeenCalled();
    });

    it("redirects signed-out users to login", async () => {
        mockParseSession.mockReturnValue(null);

        await expect(AuditPage()).rejects.toThrow("redirect:/login");
        expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("redirects viewers to the dashboard", async () => {
        mockParseSession.mockReturnValue({
            userId: "viewer-1",
            email: "viewer@optigrid.test",
            firstName: "View",
            lastName: "User",
            roleType: "VIEWER",
        });

        await expect(AuditPage()).rejects.toThrow("redirect:/dashboard");
        expect(redirect).toHaveBeenCalledWith("/dashboard");
    });
});
