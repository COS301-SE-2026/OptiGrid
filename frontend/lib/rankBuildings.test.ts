import { rankByUsage } from "./rankBuildings";

describe("rankByUsage", () => {
    it("puts the busiest building first", () => {
        const ranked = rankByUsage([
            { id: "a", todayKwh: 120 },
            { id: "b", todayKwh: 480 },
            { id: "c", todayKwh: 300 },
        ]);
        expect(ranked.map((building) => building.id)).toEqual(["b", "c", "a"]);
    });

    it("keeps the original order when there is no usage yet", () => {
        const ranked = rankByUsage([{ id: "a" }, { id: "b", todayKwh: null }, { id: "c" }]);
        expect(ranked.map((building) => building.id)).toEqual(["a", "b", "c"]);
    });

    it("places buildings without usage after the ones that report usage", () => {
        const ranked = rankByUsage([{ id: "a" }, { id: "b", todayKwh: 0 }, { id: "c", todayKwh: 12 }]);
        expect(ranked.map((building) => building.id)).toEqual(["c", "b", "a"]);
    });
});