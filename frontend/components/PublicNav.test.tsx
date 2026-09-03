import { PublicNav } from "./PublicNav";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => {
    return function MockLink({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) {
        return (
            <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
                {children}
            </a>
        );
    };
});

describe("PublicNav", () => {
    describe("signed out", () => {
        beforeEach(() => {
            render(<PublicNav signedIn={false} />);
        });

        it("renders the landing page navigation links", () => {
            const nav = screen.getByRole("navigation", { name: "Primary" });
            expect(nav).toBeInTheDocument();
            expect(screen.getByRole("link", { name: "Features" })).toBeInTheDocument();
            expect(screen.getByRole("link", { name: "Outcomes" })).toBeInTheDocument();
            expect(screen.getByRole("link", { name: "Brand" })).toBeInTheDocument();
        });
        it("renders the log in and signup actions", () => {

            expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
            expect(screen.getByRole("link", { name: "Get started free" })).toHaveAttribute("href", "/signup");
        });

        it("doesn't offer a route back to the dashboard", () => {
            expect(screen.queryByRole("link", { name: "Back to dashboard" })).toBeNull();
        });
    });

    describe("signed in", () => {
        beforeEach(() => {
            render(<PublicNav signedIn />);
        });

        it("renders only the link back to the dashboard", () => {
            expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/dashboard");
            expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
            expect(screen.queryByRole("link", { name: "Get started free" })).toBeNull();
        });

        it("hides the marketing navigation links", () => {
            expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
            expect(screen.queryByRole("link", { name: "Brand" })).toBeNull();
        });
    });

    it("keeps the section anchors on the current page when no prefix is given", () => {
        render(<PublicNav signedIn={false} anchorPrefix="" />);

        expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute("href","#features");
    });
});