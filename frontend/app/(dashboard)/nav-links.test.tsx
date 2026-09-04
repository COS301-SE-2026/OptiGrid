import { render, screen } from "@testing-library/react";
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

        expect(screen.getByRole("link", { name: "Audit" })).toHaveAttribute("href", "/audit");
    });

    it.each(["VIEWER", "BUILDING_MANAGER"])("hides Audit from %s users", (role) => {
        render(<NavLinks role={role} />);

        expect(screen.queryByRole("link", { name: "Audit" })).not.toBeInTheDocument();
    });

    it("marks Audit active on nested audit routes", () => {
        mockUsePathname.mockReturnValue("/audit/details");
        render(<NavLinks role="ADMIN" />);

        expect(screen.getByRole("link", { name: "Audit" })).toHaveAttribute("aria-current", "page");
    });
});
