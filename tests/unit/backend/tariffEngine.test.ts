import { getSeason, getTOUPeriod, calculateCost } from "../../../backend/core/src/lib/tariffEngine";
import { TariffStructure, TariffSeason, TOUPeriod, TOUPeriodDefinition, TOUSchedule } from "../../../backend/core/src/types/tariff";

const timeSlot = (period: TOUPeriod, startHour: number, endHour: number): TOUPeriodDefinition => ({
    period,
    startHour,
    endHour
});

describe("Tariff Engine Unit Tests", () => {
    describe("getSeason function", () => {
        const seasons: TariffSeason[] = [
            {
                name: "Summer",
                startMonth: 9,
                endMonth: 5
            },
            {
                name:"Winter",
                startMonth: 6,
                endMonth: 8
            }
        ];

        it("should_return_Summer", () => {
            expect(getSeason(new Date("2026-01-15T12:00:00Z"), seasons)).toBe("Summer");
            expect(getSeason(new Date("2026-09-15T12:00:00Z"), seasons)).toBe("Summer");
            expect(getSeason(new Date("2026-05-15T12:00:00Z"), seasons)).toBe("Summer");
        });

        it("should_return_Winter", () => {
            expect(getSeason(new Date("2026-07-15T12:00:00Z"), seasons)).toBe("Winter");
        });

        it("should_fallback_correctly", () => {
            expect(getSeason(new Date("2026-07-15T12:00:00Z"), [])).toBe(null);
        });
    });

    describe("getTOUPeriod function test", () => {
        const schedule: TOUSchedule = {
            weekday: [
                timeSlot("Off-Peak", 0, 6),
                timeSlot("Peak", 6, 9),
                timeSlot("Standard", 9, 17),
                timeSlot("Peak", 17, 19),
                timeSlot("Standard", 19, 22),
                timeSlot("Off-Peak", 22, 24)
            ],
            saturday: [
                timeSlot("Off-Peak", 0, 7),
                timeSlot("Standard", 7, 12),
                timeSlot("Off-Peak", 12, 18),
                timeSlot("Standard", 18, 20),
                timeSlot("Off-Peak", 20, 24)
            ],
            sunday: [timeSlot("Off-Peak", 0, 24)]
        };

        it("should_get_weekday_peak", () => {
            expect(getTOUPeriod(new Date("2026-09-01T07:00:00"), schedule)).toBe("Peak");
        });

        it("should_get_weekday_standard", () => {
            expect(getTOUPeriod(new Date("2026-09-01T12:00:00"), schedule)).toBe("Standard");
        });

        it("should_get_saturday_standard", () => {
            expect(getTOUPeriod(new Date("2026-09-05T08:00:00"), schedule)).toBe("Standard");
        });

        it("should_get_sunday-offPeak", () => {
            expect(getTOUPeriod(new Date("2026-09-06T12:00:00"), schedule)).toBe("Off-Peak");
        });
    });

    describe("calculateCost function tests", () => {
        const tariff: TariffStructure = {
            type: "block_tou",
            seasons: [
                { name: "Summer", startMonth: 9, endMonth: 5 },
                { name: "Winter", startMonth: 6, endMonth: 8 }
            ],
            tou_schedule: {
                weekday: [
                    { period: "Peak", startHour: 6, endHour: 9 },
                    { period: "Standard", startHour: 9, endHour: 17 },
                    { period: "Off-Peak", startHour: 17, endHour: 24 },
                    { period: "Off-Peak", startHour: 0, endHour: 6 },
                ],
                saturday: [{ period: "Off-Peak", startHour: 0, endHour: 24 }],
                sunday: [{ period: "Off-Peak", startHour: 0, endHour: 24 }]
            },
            blocks: [
                { 
                    max_kwh: 600, 
                    rates: { 
                        "Summer": { "Peak": 2.00, "Standard": 1.50, "Off-Peak": 1.00 },
                        "Winter": { "Peak": 3.00, "Standard": 2.00, "Off-Peak": 1.50 }
                    }
                },
                { 
                    max_kwh: null, 
                    rates: { 
                        "Summer": { "Peak": 2.50, "Standard": 2.00, "Off-Peak": 1.20 },
                        "Winter": { "Peak": 4.00, "Standard": 3.00, "Off-Peak": 2.00 }
                    }
                }
            ]
        };

        it("should_calculate_cost_for_Block_1", () => {
            const cost = calculateCost("2026-09-01T07:00:00", 10, 0, tariff);
            expect(cost).toBe(20.00);
        });

        it("should_calculate_cost_for_both_blocks", () => {
            const cost = calculateCost("2026-09-01T07:00:00", 10, 595, tariff);
            expect(cost).toBe(22.50);
        });

        it("should_calculate_cost_for_block_2_winter_standard", () => {
            const cost = calculateCost("2026-07-01T12:00:00", 10, 800, tariff);
            expect(cost).toBe(30.00);
        });

        it("should_calculate_cost_for_flat rate", () => {
            const flatTariff: TariffStructure = {
                type: "flat",
                seasons: [{ name: "Flat", startMonth: 1, endMonth: 12 }],
                blocks: [{ max_kwh: null, rates: { "Flat": { "Flat": 2.50 } } }]
            };
            const cost = calculateCost("2026-09-01T07:00:00", 10, 1000, flatTariff);
            expect(cost).toBe(25.00);
        });
    });
});
