import { fireEvent, render, screen } from "@testing-library/react";
import TimelineScrubber from "./TimelineScrubber";
import { LIVE_INDEX, TIMEFRAMES } from "@/lib/heatmap";

const NOW = Date.parse("2026-09-18T10:00:00.000Z");

function renderScrubber(overrides: Partial<React.ComponentProps<typeof TimelineScrubber>> = {}) {
    const props = {
        index: LIVE_INDEX,
        now: NOW,
        playing: false,
        busy: false,
        onChange: jest.fn(),
        onTogglePlay: jest.fn(),
        onPreview: jest.fn(),
        ...overrides,
    };
    render(<TimelineScrubber {...props} />);
    return props;
}

describe("TimelineScrubber", () => {
    it("starts on live", () => {
        renderScrubber();

        expect(screen.getByText("Live", { selector: ".heat-timeline-phase" })).toBeInTheDocument();
        expect(screen.getByText("Streaming now")).toBeInTheDocument();
        expect(screen.getByLabelText("Time on the heatmap")).toHaveValue(String(LIVE_INDEX));
        expect(screen.getByRole("button", { name: "Live" })).toHaveAttribute("aria-pressed", "true");
    });

    it("labels the history and forecast stops", () => {
        const { rerender } = render(<TimelineScrubber index={0} now={NOW} playing={false} busy={false} onChange={jest.fn()} onTogglePlay={jest.fn()} />);
        expect(screen.getByText("History")).toBeInTheDocument();
        expect(screen.getByText("Last 90 days", { selector: ".heat-timeline-label" })).toBeInTheDocument();

        rerender(<TimelineScrubber index={TIMEFRAMES.length - 1} now={NOW} playing={false} busy={false} onChange={jest.fn()} onTogglePlay={jest.fn()} />);
        expect(screen.getByText("Forecast")).toBeInTheDocument();
        expect(screen.getByText(/^Forecast for /)).toBeInTheDocument();
    });

    it("moves when the slider is dragged or when a stop is chosen", () => {
        const props = renderScrubber();

        fireEvent.change(screen.getByLabelText("Time on the heatmap"), { target: { value: "5" } });
        expect(props.onChange).toHaveBeenLastCalledWith(5);

        fireEvent.click(screen.getByRole("button", { name: "Last 7 days" }));
        expect(props.onChange).toHaveBeenLastCalledWith(2);
    });

    it("plays and pauses", () => {
        const props = renderScrubber();
        fireEvent.click(screen.getByRole("button", { name: /play the timeline/i }));
        expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
    });

    it("warms up a period when a stop is hovered or focused", () => {
        const props = renderScrubber();

        fireEvent.mouseEnter(screen.getByRole("button", { name: "In 7 days" }));
        fireEvent.focus(screen.getByRole("button", { name: "In 90 days" }));

        expect(props.onPreview).toHaveBeenCalledWith(4);
        expect(props.onPreview).toHaveBeenCalledWith(6);
    });

    it("shows a pause control while playing and a loading note while busy", () => {
        renderScrubber({ playing: true, busy: true });

        expect(screen.getByRole("button", { name: "Pause the timeline" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("status")).toHaveTextContent("Loading");
    });
});