import { TariffStructure, TariffSeason, TOUSchedule } from "../../../backend/core/src/types/tariff";

describe("Tariff Types", () => {
    it("should_create_valid_TariffSeason_object", () => {
        const season: TariffSeason = {
            name: "Summer",
            startMonth: 9,
            endMonth: 5
        };
        //assert
        expect(season.name).toBe("Summer");
        expect(season.startMonth).toBe(9);
    });

    it("should_create_valid_TOUSchedule_object", () => {
        const schedule: TOUSchedule = {
            weekday: [{ period: "Peak", startHour: 6, endHour: 9 }],
            saturday: [{ period: "Standard", startHour: 7, endHour: 12 }],
            sunday: [{ period: "Off-Peak", startHour: 0, endHour: 24 }]
        };
        //assert
        expect(schedule.weekday[0].period).toBe("Peak");
    });

    it("should_create_a_valid_TariffStructure_object", () => {
        const tariff: TariffStructure = {
            type: "block_tou",
            seasons: [{ name: "Summer", startMonth: 9, endMonth: 5 }],
            blocks: [{
                max_kwh: null,
                rates: {
                    "Summer": { "Peak": 2.50 }
                }
            }]
        };
        //assert
        expect(tariff.type).toBe("block_tou");
        expect(tariff.blocks[0].rates["Summer"]["Peak"]).toBe(2.50);
    });
});
