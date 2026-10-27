import { twinRenderSettings } from "./twinQuality";

describe("twinRenderSettings", () => {
    it("keeps the adaptive behaviour for Auto", () => {
        expect(twinRenderSettings("auto", 2)).toEqual({
            maxDpr: 1.75,
            minDpr: 1,
            antialias: true,
            powerPreference: "high-performance",
            adaptive: true,
            lowQuality: false,
            calm: false,
        });
        expect(twinRenderSettings("auto", 1).maxDpr).toBe(1);
    });

    it("draws a calm, cheap scene for Battery saver", () => {
        expect(twinRenderSettings("saver", 3)).toEqual({
            maxDpr: 1,
            minDpr: 1,
            antialias: false,
            powerPreference: "low-power",
            adaptive: false,
            lowQuality: true,
            calm: true,
        });
    });

    it("treats a missing pixel ratio as 1", () => {
        expect(twinRenderSettings("high", Number.NaN).maxDpr).toBe(1);
        expect(twinRenderSettings("auto", 0).maxDpr).toBe(1);
    });

    it("holds full resolution for High", () => {
        const settings = twinRenderSettings("high", 3);
        expect(settings).toMatchObject({ maxDpr: 2, minDpr: 2, antialias: true, adaptive: false, lowQuality: false });
        expect(twinRenderSettings("high", 1.5).maxDpr).toBe(1.5);
    });
});