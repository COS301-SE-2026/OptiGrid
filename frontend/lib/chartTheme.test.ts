import { formatAxisNumber, formatAxisRand, niceAxis, seriesDot } from "./chartTheme";

describe("chart axis formatting", () => {
    it("groups thousands and drops decimals on an axis", () => {
        expect(formatAxisNumber(12000)).toBe((12000).toLocaleString());
        expect(formatAxisNumber(2329.6)).toBe((2330).toLocaleString());
        expect(formatAxisNumber(0)).toBe("0");
    });

    it("prefixes rand values", () => {
        expect(formatAxisRand(5000)).toBe(`R ${(5000).toLocaleString()}`);
    });

    it("returns nothing for values that cannot be drawn", () => {
        expect(formatAxisNumber(Number.NaN)).toBe("");
        expect(formatAxisRand(Number.POSITIVE_INFINITY)).toBe("");
    });

    it("rings each point in the surface colour so it separates from the line", () => {
        expect(seriesDot("var(--chart-1)")).toEqual({ r: 4, fill: "var(--chart-1)", stroke: "var(--brand-surface)", strokeWidth: 2 });
    });
});

describe("niceAxis", () => {
    it("keeps the small values readable", () => {
        expect(niceAxis(3.4).ticks).toEqual([0, 1, 2, 3, 4]);
        expect(niceAxis(0.42).ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it("lands on the round steps with a little headroom", () => {
        expect(niceAxis(2100)).toEqual({ domain: [0, 2500], ticks: [0, 500, 1000, 1500, 2000, 2500] });
        expect(niceAxis(452)).toEqual({ domain: [0, 500], ticks: [0, 100, 200, 300, 400, 500] });
        expect(niceAxis(11200).ticks).toEqual([0, 2500, 5000, 7500, 10000, 12500]);
    });

    it("falls back to a unit axis when there is nothing to draw", () => {
        expect(niceAxis(0).domain).toEqual([0, 1]);
        expect(niceAxis(Number.NaN).domain).toEqual([0, 1]);
    });
});