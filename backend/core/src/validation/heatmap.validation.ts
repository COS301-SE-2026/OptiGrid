import { z } from "zod";

export const HeatmapTimeframeSchema = z.enum([
  "-90d", "-30d", "-7d",
  "live",
  "+7d", "+30d", "+90d"
]);

export type HeatmapTimeframe = z.infer<typeof HeatmapTimeframeSchema>;

export const getHeatmapSchema = z.object({
  query: z.object({
    timeframe: HeatmapTimeframeSchema
  })
});
