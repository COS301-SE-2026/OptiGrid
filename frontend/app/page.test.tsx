import { render, screen } from "@testing-library/react";
import LandingPage from "./page";

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

describe("LandingPage", () => {
    beforeEach(() => {
        render(<LandingPage />);
    });

    describe("navbar", () => {
        it("renders the brand name", () => {
            expect(screen.getByText(/⚡ OptiGrid/)).toBeInTheDocument();
        });

        it("renders the Features nav link", () => {
            expect(screen.getByText("Features")).toBeInTheDocument();
        });

        it("renders the Pricing nav link", () => {
            expect(screen.getByText("Pricing")).toBeInTheDocument();
        });

        it("renders the Contact nav link", () => {
            expect(screen.getByText("Contact")).toBeInTheDocument();
        });

        it("renders a Log in link pointing to /login", () => {
            const loginLink = screen.getByRole("link", { name: "Log in" });
            expect(loginLink).toHaveAttribute("href", "/login");
        });
    });

    describe("hero", () => {
        it("renders the main heading", () => {
            expect(
                screen.getByRole("heading", { level: 1 })
            ).toBeInTheDocument();
        });

        it("renders the sub-headline copy", () => {
            expect(
                screen.getByText(/unifies IoT telemetry/)
            ).toBeInTheDocument();
        });

        it("renders a Get started free link pointing to /signup", () => {
            const signupLink = screen.getByRole("link", {
                name: "Get started free",
            });
            expect(signupLink).toHaveAttribute("href", "/signup");
        });

        it("renders a Book a demo link", () => {
            expect(
                screen.getByRole("link", { name: "Book a demo" })
            ).toBeInTheDocument();
        });
    });

    describe("features section", () => {
        it("renders the section label", () => {
            expect(screen.getByText(/What you can do/i)).toBeInTheDocument();
        });

        it("renders all three feature headings", () => {
            expect(
                screen.getByRole("heading", { name: "Monitor your portfolio" })
            ).toBeInTheDocument();
            expect(
                screen.getByRole("heading", { name: "Benchmark performance" })
            ).toBeInTheDocument();
            expect(
                screen.getByRole("heading", { name: "Forecast tomorrow's demand" })
            ).toBeInTheDocument();
        });

        it("renders the description for Monitor your portfolio", () => {
            expect(screen.getByText(/Live kWh, peak load/)).toBeInTheDocument();
        });

        it("renders the description for Benchmark performance", () => {
            expect(
                screen.getByText(/Compare buildings side-by-side/)
            ).toBeInTheDocument();
        });

        it("renders the description for Forecast tomorrow's demand", () => {
            expect(
                screen.getByText(/ML-driven predictions/)
            ).toBeInTheDocument();
        });
    });

    describe("footer", () => {
        it("renders the copyright notice", () => {
            expect(screen.getByText(/© 2026 OptiGrid/)).toBeInTheDocument();
        });
    });
});
