import { render, screen, within } from "@testing-library/react";
import LandingPage from "./page";

jest.mock("next/link");

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
                screen.getByText(/shows what each of your buildings uses right now/)
            ).toBeInTheDocument();
        });

        it("points visitors down to the features", () => {
            expect(screen.getByRole("link", { name: "See what it does" })).toHaveAttribute("href", "#features");
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
            expect(screen.getByText(/See live power and today/)).toBeInTheDocument();
        });

        it("renders the description for Benchmark performance", () => {
            expect(
                screen.getByText(/Put two buildings side by side/)
            ).toBeInTheDocument();
        });

        it("renders the description for Forecast tomorrow's demand", () => {
            expect(
                screen.getByText(/hourly forecast/)
            ).toBeInTheDocument();
        });

        it("renders the all the newer feature headings", () => {
            expect(screen.getByRole("heading", { name: "Catch anomalies early" })).toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "Act on load shifting insights" })).toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "Keep tariffs and costs current" })).toBeInTheDocument();
        });

        it("renders the map and 3D feature cards", () => {
            expect(screen.getByRole("heading", { name: "See usage on a map" })).toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "Explore each building in 3D" })).toBeInTheDocument();
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
            expect(outcomesScope.getByRole("heading", { name: "Audit ready reports" })).toBeInTheDocument();
            expect(outcomesScope.getByRole("heading", { name: "ESG health score" })).toBeInTheDocument();
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
