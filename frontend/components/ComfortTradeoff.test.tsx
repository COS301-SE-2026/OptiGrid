import { fireEvent, render, screen } from "@testing-library/react";
import ComfortTradeoff, { comfortBand, type TradeoffProfile } from "./ComfortTradeoff";

function buildProfile(): TradeoffProfile {
    const points = Array.from({ length: 101 }, (_, level) => ({
        savings_level: level,
        monthly_savings: level * 5,
        comfort_score: Math.round(100 - 55 * (level / 100) ** 2),
        shed_kw: level / 2
    }));
    return { 
        comfort_target: 80, 
        full_monthly_savings: 500, 
        sweet_spot: points[61], 
        points 
    };
}

function renderTradeoff(level: number, adjusted = true) {
    const onLevelChange = jest.fn();
    render(<ComfortTradeoff profile={buildProfile()} level={level} adjusted={adjusted} onLevelChange={onLevelChange} />);
    return onLevelChange;
}

function comfortGauge() {
    return screen.getByRole("meter", { name: "Employee comfort" });
}

describe("ComfortTradeoff", () => {
    it("starts at maximum comfort with nothing saved and then tells the manager to choose a setting", () => {
        renderTradeoff(0, false);
        expect(screen.getByText("R 0.00")).toBeInTheDocument();
        expect(comfortGauge()).toHaveAttribute("aria-valuenow", "100");
        expect(screen.getByText("Comfortable")).toBeInTheDocument();
        expect(screen.getByText(/drag the slider to choose how hard to shave the peak/i)).toBeInTheDocument();
    });

    it("shows an amber once the comfort slips under the target", () => {
        renderTradeoff(70);
        expect(comfortGauge()).toHaveAttribute("aria-valuenow", "73");
        expect(screen.getByText("Strained")).toHaveClass("comfort-band-strained");
    });

    it("turns the gauge red when savings are pushed to the aggressive end", () => {
        renderTradeoff(100);
        expect(screen.getByText("R 500.00")).toBeInTheDocument();
        expect(comfortGauge()).toHaveAttribute("aria-valuenow", "45");
        expect(screen.getByText("Uncomfortable")).toHaveClass("comfort-band-poor");
        expect(comfortGauge().querySelector(".comfort-gauge-fill")).toHaveClass("comfort-gauge-poor");
        expect(screen.getByText(/drops below the 80\/100 target/i)).toBeInTheDocument();
    });


    it("confirms the sweet spot where savings peak without breaking comfort", () => {
        renderTradeoff(61);
        expect(screen.getByText("R 305.00")).toBeInTheDocument();
        expect(comfortGauge()).toHaveAttribute("aria-valuenow", "80");
        expect(screen.getByText("Sweet spot: R 305.00 a month while comfort holds at 80/100.")).toBeInTheDocument();
    });

    it("points out the room to save more before the sweet spot", () => {
        renderTradeoff(30);
        expect(screen.getByText(/there is room to save more before it reaches 80\/100/i)).toBeInTheDocument();
    });

    it("runs the slider from aggressive savings to maximum comfort", () => {
        renderTradeoff(0);
        expect(screen.getByLabelText("Savings level")).toHaveValue("100");
        expect(screen.getByText("Aggressive Savings")).toBeInTheDocument();
        expect(screen.getByText("Maximum Comfort")).toBeInTheDocument();
        expect(screen.getByText("Sweet spot")).toBeInTheDocument();
    });

    it("reports the savings level while the slider is being dragged towards aggressive savings", () => {
        const onLevelChange = renderTradeoff(0, false);
        fireEvent.change(screen.getByLabelText("Savings level"), { target: { value: "39" } });
        expect(onLevelChange).toHaveBeenCalledWith(61);
    });

    it("gives bands to the comfort scores against the target", () => {
        expect(comfortBand(80, 80)).toBe("good");
        expect(comfortBand(79, 80)).toBe("strained");
        expect(comfortBand(60, 80)).toBe("strained");
        expect(comfortBand(59, 80)).toBe("poor");
    });

    
    it("locks the slider when the recommendation cannot be reviewed", () => {
        render(<ComfortTradeoff profile={buildProfile()} level={0} adjusted={false} disabled onLevelChange={jest.fn()} />);
        expect(screen.getByLabelText("Savings level")).toBeDisabled();
    });
});