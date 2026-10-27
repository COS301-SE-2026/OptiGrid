import { mapRenderOptions } from "./mapQuality";

describe("mapRenderOptions", () => {
    it("leaves the map options untouched for Auto", () => {
        expect(mapRenderOptions("auto", 2)).toEqual({});
    });

    it("lowers the pixel ratio and asks for a low power context for Battery saver", () => {
        expect(mapRenderOptions("saver", 2)).toEqual({
            pixelRatio: 1,
            canvasContextAttributes: { antialias: false, powerPreference: "low-power" },
        });
    });

    it("turns on smoothing for High and caps the pixel ratio at 2", () => {
        expect(mapRenderOptions("high", 3)).toEqual({
            pixelRatio: 2,
            canvasContextAttributes: { antialias: true, powerPreference: "high-performance" },
        });
    });

    it("copes with an unknown pixel ratio", () => {
        expect(mapRenderOptions("saver", Number.NaN).pixelRatio).toBe(1);
    });
});