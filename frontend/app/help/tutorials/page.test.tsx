import { render, screen, within } from "@testing-library/react";
import TutorialsPage from "./page";

describe("TutorialsPage", () => {
    beforeEach(() => {
        render(<TutorialsPage />);
    });

    it("renders the brand and navigation", () => {
        expect(screen.getByText("OptiGrid")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/dashboard");
    });

    it("renders the tutorial library with placeholder video cards", () => {
        expect(
            screen.getByRole("heading", {
                name: "Learn OptiGrid in just a few minutes.",
            })
        ).toBeInTheDocument();

        const signupCard = screen.getByRole("heading", { name: "Sign up for an OptiGrid account" }).closest("article");
        expect(signupCard).not.toBeNull();
        expect(within(signupCard as HTMLElement).getByText("Source pending")).toBeInTheDocument();
        expect(screen.getByText("Add a building")).toBeInTheDocument();
        expect(screen.getByText("Edit or delete a building")).toBeInTheDocument();
        expect(screen.getByText("Review demand forecasts")).toBeInTheDocument();
    });
});