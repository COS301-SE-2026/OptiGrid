jest.mock("@influxdata/influxdb-client", () => ({
  InfluxDB: jest.fn(),
}));

import { resolveCostZar, UTILITY_COST_USD_PER_KWH, UTILITY_COST_ZAR_PER_KWH, ZAR_PER_USD } from "../../../backend/core/src/lib/influx";

describe("resolveCostZar", () => {
  it("uses the recorded rand cost when the meter reports one", () => {
    expect(resolveCostZar(482.75, 0, 190)).toBe(482.75);
  });
  it("prefers the rand cost even when a dollar cost is also available", () => {
    expect(resolveCostZar(482.75, 25.1, 190)).toBe(482.75);
  });

  it("converts a dollar cost instead of reporting it using rands", () => {
    const costUsd = 25;
    expect(resolveCostZar(0, costUsd, 190)).toBeCloseTo(costUsd * ZAR_PER_USD, 6);
  });

  it("does not report a dollar amount unchanged", () => {
    expect(resolveCostZar(0, 25, 190)).not.toBe(25);
  });

  it("keeps the conversion rate consistent with the two tariff constants", () => {
    expect(ZAR_PER_USD).toBeCloseTo(UTILITY_COST_ZAR_PER_KWH / UTILITY_COST_USD_PER_KWH, 6);
  });

  it("falls back to the tariff rate when no cost was recorded", () => {
    expect(resolveCostZar(0, 0, 190)).toBeCloseTo(190 * UTILITY_COST_ZAR_PER_KWH, 6);
  });

  it("values a kwh the same regardless of the currency the meter reported", () => {
    const kwh = 100;
    const fromTariff = resolveCostZar(0, 0, kwh);
    const fromUsd = resolveCostZar(0, kwh * UTILITY_COST_USD_PER_KWH, kwh);
    
    expect(fromUsd).toBeCloseTo(fromTariff, 6);
  });
});