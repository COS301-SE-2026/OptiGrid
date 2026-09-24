import { HeatmapTimeframeSchema } from "../../../backend/core/src/validation/heatmap.validation";

describe("Heatmap Validation Unit Tests", () => {
    it("should_validate_the_timeframe_we_have_allowed", () => {
        expect(HeatmapTimeframeSchema.safeParse("-90d").success).toBe(true);
        expect(HeatmapTimeframeSchema.safeParse("-30d").success).toBe(true);
        expect(HeatmapTimeframeSchema.safeParse("-7d").success).toBe(true);
        expect(HeatmapTimeframeSchema.safeParse("live").success).toBe(true);
        expect(HeatmapTimeframeSchema.safeParse("+7d").success).toBe(true);
        expect(HeatmapTimeframeSchema.safeParse("+30d").success).toBe(true);
        expect(HeatmapTimeframeSchema.safeParse("+90d").success).toBe(true);
    });

    it("should_not_validate", () => {
        expect(HeatmapTimeframeSchema.safeParse("1d").success).toBe(false);
        expect(HeatmapTimeframeSchema.safeParse("").success).toBe(false);
        expect(HeatmapTimeframeSchema.safeParse(null).success).toBe(false);
    });
});
