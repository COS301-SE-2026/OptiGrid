import { render, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { NavLinks } from "./nav-links";

jest.mock("next/navigation", () => ({
    usePathname: jest.fn(),
}));

const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

describe("NavLinks audit visibility", () => {
    beforeEach(() => {
        mockUsePathname.mockReturnValue("/dashboard");
    });

    it.each(["ADMIN"])("shows Audit to %s users", (role) => {
        render(<NavLinks role={role} />);

        expect(screen.getByRole("link", { name: "Audit" })).toHaveAttribute("href", expect.stringMatching(/^\/_sessions\/[0-9a-f-]+\/audit$/));
    });

    it.each(["VIEWER", "BUILDING_MANAGER"])("hides Audit from %s users", (role) => {
        render(<NavLinks role={role} />);

        expect(screen.queryByRole("link", { name: "Audit" })).not.toBeInTheDocument();
    });

    it.each(["ADMIN", "BUILDING_MANAGER", "VIEWER"])("offers the heatmap to %s users", (role) => {
        render(<NavLinks role={role} />);
        expect(screen.getByRole("link", { name: "Heatmap" })).toHaveAttribute("href", expect.stringMatching(/^\/_sessions\/[0-9a-f-]+\/heatmap$/));
    });

    it("marks Audit active on nested audit routes", () => {
        mockUsePathname.mockReturnValue("/audit/details");
        render(<NavLinks role="ADMIN" />);

        expect(screen.getByRole("link", { name: "Audit" })).toHaveAttribute("aria-current", "page");
    });
});

describe("NavLinks layout", () => {
    beforeEach(() => {
        mockUsePathname.mockReturnValue("/dashboard");
    });

    it("keeps the settings link with the help and contact links", () => {
        render(<NavLinks role="VIEWER" />);
        const support = screen.getByRole("navigation", { name: "Account and support" });

        expect(within(support).getByRole("link", { name: "Settings" })).toHaveAttribute("href", expect.stringMatching(/\/settings$/));
        expect(within(support).getByRole("link", { name: "Help Centre" })).toHaveAttribute("href", expect.stringMatching(/\/help$/));
        expect(within(support).getByRole("link", { name: "Contact Us" })).toHaveAttribute("href", expect.stringMatching(/\/contact$/));
        expect(within(screen.getByRole("navigation", { name: "Dashboard" })).queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    });

    it("only shows the sections which a role can use", () => {
        render(<NavLinks role="VIEWER" />);

        expect(screen.getByRole("list", { name: "Monitoring" })).toBeInTheDocument();
        expect(within(screen.getByRole("list", { name: "Monitoring" })).getByRole("link", { name: "Anomaly" })).toHaveAttribute("href", expect.stringMatching(/\/useranomaly$/));
        expect(screen.queryByRole("list", { name: "Administration" })).not.toBeInTheDocument();
    });

    it("lists the manager tools under Administration", () => {
        render(<NavLinks role="BUILDING_MANAGER" />);
        const admin = screen.getByRole("list", { name: "Administration" });

        expect(within(admin).getByRole("link", { name: "Manage" })).toHaveAttribute("href", expect.stringMatching(/\/manager$/));
        expect(within(admin).queryByRole("link", { name: "Tariff rates" })).not.toBeInTheDocument();
    });

    it("names the browser tab after the name of the current page", () => {
        mockUsePathname.mockReturnValue("/heatmap");
        const { unmount } = render(<NavLinks role="VIEWER" />);
        expect(document.title).toBe("Heatmap - OptiGrid");
        unmount();

        mockUsePathname.mockReturnValue("/buildings/b1/view");
        render(<NavLinks role="VIEWER" />);
        expect(document.title).toBe("Building details - OptiGrid");
    });

    it("marks the settings link active on the settings page", () => {
        mockUsePathname.mockReturnValue("/_sessions/11111111-1111-4111-8111-111111111111/settings");
        render(<NavLinks role="ADMIN" />);

        expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    });

    it("keeps the parent link active on building and user pages", () => {
        mockUsePathname.mockReturnValue("/buildings/b1/view");
        const { unmount } = render(<NavLinks role="ADMIN" />);
        expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
        unmount();

        mockUsePathname.mockReturnValue("/useradmin");
        render(<NavLinks role="ADMIN" />);
        expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("aria-current", "page");
    });
});
