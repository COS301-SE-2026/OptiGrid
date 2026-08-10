import { within, render, screen } from "@testing-library/react";
import HelpPage from "./page";

describe("HelpPage", () => {
        beforeEach(() => {
            render(<HelpPage />);
    });

    it("renders the brand name and back to the dashboard link", () => {
        expect(screen.getByText("OptiGrid")).toBeInTheDocument();
        const dashboardLink = screen.getByRole("link", {
            name: "Back to dashboard",
        });
        expect(dashboardLink).toHaveAttribute("href", "/dashboard");
    });

    it("renders the help heading and intro copy", () => {
        expect(
            screen.getByRole("heading", {
                name: "Pick one of the resources available below to help with your problem",
            })
        ).toBeInTheDocument();
        expect(screen.getByText(/our help centre groups the most useful resources/i)).toBeInTheDocument();
    });

    it("renders all the quick access cards with their actions", () => {
        const main = screen.getByRole("main");
        expect(within(main).getByRole("heading", { name: "User manual" })).toBeInTheDocument();
        expect(within(main).getByRole("heading", { name: "Tutorials" })).toBeInTheDocument();
        expect(within(main).getByRole("heading", { name: "FAQs" })).toBeInTheDocument();
        expect(within(main).getByRole("heading", { name: "Contact support" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Open manual/i })).toHaveAttribute(
    "href",
    "/help/manual"
  );
  expect(screen.getByRole("link", { name: /View tutorials/i })).toHaveAttribute(
    "href",
    "/help/tutorials"
  );
  expect(screen.getByRole("link", { name: /Read FAQs/i })).toHaveAttribute(
    "href",
    "/faqs"
  );
  expect(screen.getByRole("link", { name: /Contact us/i })).toHaveAttribute(
    "href",
    "/contact"
  );
    });

    it("renders the help footer", () => {
        expect(screen.getByText(/© 2026 OptiGrid\. All rights reserved\./)).toBeInTheDocument();
    });
});