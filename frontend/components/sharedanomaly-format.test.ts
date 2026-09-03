import {
  formatAxisTick,
  formatMetricValue,
  roundToTwo,
  toFiniteValue,
} from "./sharedanomaly";

describe("anomaly chart value formatting", () => {
  describe("toFiniteValue", () => {
    it.each([
      { input: 12.5, expected: 12.5 },
      { input: "12.5", expected: 12.5 },
      { input: null, expected: 0 },
      { input: undefined, expected: 0 },
      { input: Number.NaN, expected: 0 },
      { input: Number.POSITIVE_INFINITY, expected: 0 },
    ])("converts $input to a usable number", ({ input, expected }) => {
      expect(toFiniteValue(input)).toBe(expected);
    });
  });

  describe("roundToTwo", () => {
    it("removes the floating point tail that influx averages produce", () => {
      expect(roundToTwo(1847.3333333333335)).toBe(1847.33);
    });

    it("falls back to zero for values that are not finite", () => {
      expect(roundToTwo(Number.NaN)).toBe(0);
    });
  });

  describe("formatMetricValue", () => {
    it("prefixes cost with the rand symbol", () => {
      expect(formatMetricValue(4618.5, "cost")).toBe("R 4,618.50");
    });

    it("add suffixes to energy with the kwh unit", () => {
      expect(formatMetricValue(1847.3333333333335, "power")).toBe("1,847.33 kWh");
    });

    it("renders zero rather than a broken value when input is not finite", () => {
      expect(formatMetricValue(Number.NaN, "power")).toBe("0.00 kWh");

    it("always shows two decimals so values line up", () => {
      expect(formatMetricValue(12, "cost")).toBe("R 12.00");
    });
    });
  });

  describe("formatAxisTick", () => {
    it("drops decimals once a tick is large enough not to need them", () => {
      expect(formatAxisTick(4618.5)).toBe("4,619");
    });

    it("keeps decimals on small ticks", () => {
      expect(formatAxisTick(2.456)).toBe("2.46");
    });

    it("returns zero for values that are not finite", () => {
      expect(formatAxisTick(Number.NaN)).toBe("0");
    });
  });
});