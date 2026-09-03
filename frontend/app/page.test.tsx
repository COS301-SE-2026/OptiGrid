import { render, screen, within } from "@testing-library/react";
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
            expect(screen.getByText("OptiGrid")).toBeInTheDocument();
        });

        it("renders the Features nav link", () => {
            expect(screen.getByText("Features")).toBeInTheDocument();
        });

        it("renders the Outcomes nav link", () => {
            expect(screen.getByText("Outcomes")).toBeInTheDocument();
        });

        it("renders a Log in link pointing to /login", () => {
            const loginLink = screen.getByRole("link", { name: "Log in" });
            expect(loginLink).toHaveAttribute("href", "/login");
        });

        it("renders a Get started free link pointing to signup page", () => {
            const signupLink = screen.getByRole("link", {
                name: "Get started free",
            });
            expect(signupLink).toHaveAttribute("href", "/signup");
        });

        it("renders the Brand download link", () => {
            expect(screen.getByRole("link", { name: "Brand" })).toBeInTheDocument();
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

        it("does not render a Get started free link in the hero", () => {
            const main = screen.getByRole("main");
            const heroHeading = within(main).getByRole("heading", {
                name: "Cut energy costs across every building you operate.",
            });
            const heroSection = heroHeading.closest("section");
            expect(heroSection).not.toBeNull();
            expect(within(heroSection as HTMLElement).queryByRole("link", {name: "Get started free"})).toBeNull();
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
                screen.getByText(/Compare buildings side by side/)
            ).toBeInTheDocument();
        });

        it("renders the description for Forecast tomorrow's demand", () => {
            expect(
                screen.getByText(/ML-driven predictions/)
            ).toBeInTheDocument();
        });

        it("renders the all the newer feature headings", () => {
            expect(screen.getByRole("heading", { name: "Catch anomalies early" })).toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "Act on load shifting insights" })).toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "Keep tariffs and costs current" })).toBeInTheDocument();
        });
    });

    describe("footer", () => {
        it("renders the copyright notice", () => {
            expect(screen.getByText(/© 2026 OptiGrid/)).toBeInTheDocument();
        });
    });

    describe("outcomes section", () => {
        it("renders the outcomes heading", () => {
            expect(
                screen.getByRole("heading", {
                    name: "Move from raw telemetry to decisions.",
                })
            ).toBeInTheDocument();
        });

        it("renders the outcomes metric cards", () => {
            const outcomesHeading = screen.getByRole("heading", {
                name: "Move from raw telemetry to decisions.",
            });
            const outcomesSection = outcomesHeading.closest("section");
            expect(outcomesSection).not.toBeNull();
            const outcomesScope = within(outcomesSection as HTMLElement);
            expect(
                outcomesScope.getByRole("heading", { name: "Peak load reduction" })
            ).toBeInTheDocument();
            expect(
                outcomesScope.getByRole("heading", { name: "Forecast error" })
            ).toBeInTheDocument();
            expect(
                outcomesScope.getByRole("heading", { name: "Buildings online" })
            ).toBeInTheDocument();
            expect(outcomesScope.getByRole("heading", { name: "Live refresh" })).toBeInTheDocument();
            expect(outcomesScope.getByRole("heading", { name: "Measures watched" })).toBeInTheDocument();
            expect(outcomesScope.getByRole("heading", { name: "Forecast horizon" })).toBeInTheDocument();
        });
    });

    describe("cta section", () => {
        it("renders the CTA heading", () => {
            expect(
                screen.getByRole("heading", {
                    name: "Build a smarter energy strategy this quarter.",
                })
            ).toBeInTheDocument();
        });

        it("renders the Start your free trial link", () => {
            const ctaLink = screen.getByRole("link", {
                name: "Start your free trial",
            });
            expect(ctaLink).toHaveAttribute("href", "/signup");
        });
    });
});
