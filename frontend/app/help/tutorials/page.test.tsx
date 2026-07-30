import { render, screen } from "@testing-library/react";
import TutorialsPage from "./page";

describe("TutorialsPage", () => {
    beforeEach(() => {
        render(<TutorialsPage />);
    });

    it("renders the brand and navigation", () => {
        expect(screen.getByText("OptiGrid")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/dashboard");
    });

    it("renders the tutorial library", () => {
        expect(
            screen.getByRole("heading", {
                name: "Learn OptiGrid in just a few minutes.",
            })
        ).toBeInTheDocument();

        expect(screen.getByText("Add a building")).toBeInTheDocument();
        expect(screen.getByText("Compare two buildings")).toBeInTheDocument();
        expect(screen.getByText("Review demand forecasts")).toBeInTheDocument();
    });

    it("plays a video for each tutorial rather than a placeholder", () => {
        const expectedSources: Array<[string, string]> = [
            ["Sign up for an OptiGrid account", "/help/tutorials/signup.mp4"],
            ["Log in", "/help/tutorials/login.mp4"],
            ["Add a building", "/help/tutorials/add_building.mp4"],
            ["Compare two buildings", "/help/tutorials/compare_buildings.mp4"],
            ["Review demand forecasts", "/help/tutorials/run_forecast.mp4"]
        ];

        for (const [title, source] of expectedSources) {
            const card = screen.getByRole("heading", { name: title }).closest("article");
            
            expect(card).not.toBeNull();
            expect((card as HTMLElement).querySelector("source")).toHaveAttribute("src", source);
        }
        //every card now has a real video
        expect(screen.queryByText("Source pending")).not.toBeInTheDocument();
    });
});