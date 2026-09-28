import { render, screen, within } from "@testing-library/react";
import TutorialsPage from "./page";
import { existsSync } from "fs";

jest.mock("fs", () => ({
    ...jest.requireActual("fs"),
    existsSync: jest.fn(),
}));

const mockExists = existsSync as jest.MockedFunction<typeof existsSync>;

function cardFor(title: string): HTMLElement {
    const card = screen.getByRole("heading", { name: title }).closest("li");
    expect(card).not.toBeNull();
    return card as HTMLElement;
}

describe("TutorialsPage", () => {
    beforeEach(() => {
        mockExists.mockReset();
        mockExists.mockReturnValue(true);
    });

    it("renders the brand and navigation", () => {
        render(<TutorialsPage />);
        expect(screen.getByText("OptiGrid")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/dashboard");
    });

    it("renders the tutorial library", () => {
        render(<TutorialsPage />);
        expect(
            screen.getByRole("heading", {
                name: "Learn OptiGrid in just a few minutes.",
            })
        ).toBeInTheDocument();

        expect(screen.getByText("Add a building")).toBeInTheDocument();
        expect(screen.getByText("Compare two buildings")).toBeInTheDocument();
        expect(screen.getByText("Use the energy heatmap")).toBeInTheDocument();
        expect(screen.getByText("Explore the digital twin")).toBeInTheDocument();
        expect(screen.getByText("Review demand forecasts")).toBeInTheDocument();
    });

    it("plays a video for every tutorial that has a source recorded", () => {
        render(<TutorialsPage />);
        const expectedSources: Array<[string, string]> = [
            ["Add a building", "/help/tutorials/add_building.mp4"],
            ["Compare two buildings", "/help/tutorials/compare_buildings.mp4"],
            ["Use the energy heatmap", "/help/tutorials/heatmap.mp4"],
            ["Explore the digital twin", "/help/tutorials/digital_twin.mp4"],
            ["Review demand forecasts", "/help/tutorials/run_forecast.mp4"],
            ["Review insights", "/help/tutorials/review_insights.mp4"],
            ["View anomaly alerts", "/help/tutorials/review_anomaly.mp4"],
            ["Manage your profile and settings", "/help/tutorials/manage_account.mp4"]
        ];

        for (const [title, source] of expectedSources) {
            expect(cardFor(title).querySelector("source")).toHaveAttribute("src", source);
        }
    });

    it("shows a placeholder until the video file is uploaded", () => {
        mockExists.mockImplementation((file) => !String(file).endsWith("heatmap.mp4"));
        render(<TutorialsPage />);

        const card = cardFor("Use the energy heatmap");
        expect(card.querySelector("video")).toBeNull();
        expect(within(card).getByRole("img", { name: "Use the energy heatmap video coming soon" })).toBeInTheDocument();
        expect(within(card).getByText("Written steps")).toBeInTheDocument();
        expect(cardFor("Explore the digital twin").querySelector("source")).toHaveAttribute("src", "/help/tutorials/digital_twin.mp4");
    });

    it("leaves out a poster that has not been uploaded", () => {
        mockExists.mockImplementation((file) => !String(file).endsWith("digital_twin-poster.jpg"));
        render(<TutorialsPage />);

        const video = cardFor("Explore the digital twin").querySelector("video");
        expect(video).not.toHaveAttribute("poster");
        expect(video).toHaveAttribute("preload", "metadata");
        expect(cardFor("Use the energy heatmap").querySelector("video")).toHaveAttribute("poster", "/help/tutorials/heatmap-poster.jpg");
    });
});