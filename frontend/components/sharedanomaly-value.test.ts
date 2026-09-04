import { formatZScoreDeviation, getZScoreLabel } from "./sharedanomaly";

describe("anomaly deviation values", () => {
  it.each([
    { zScore: 4.2, label: "Extreme Spike" },
    { zScore: -4.2, label: "Extreme Spike" },
    { zScore: 3.1, label: "High Spike" },
    { zScore: -3.1, label: "High Spike" },
    { zScore: 2.1, label: "Moderate Spike" },
    { zScore: -2.1, label: "Moderate Spike" },
    { zScore: 1.5, label: "Slight Variance" },
    { zScore: -1.5, label: "Slight Variance" },
  ])("classifies $zScore by its absolute magnitude", ({ zScore, label }) => {
    expect(getZScoreLabel(zScore)).toBe(label);
  });

  it.each([
    { zScore: 4.2, formatted: "+4.2σ from baseline" },
    { zScore: -5.6, formatted: "-5.6σ from baseline" },
    { zScore: 0, formatted: "+0.0σ from baseline" },
  ])("formats $zScore with exactly one sign", ({ zScore, formatted }) => {
    expect(formatZScoreDeviation(zScore)).toBe(formatted);
  });
});
