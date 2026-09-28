type RankedBuilding = {
    id: string;
    todayKwh?: number | null;
};

// busiest building first. the original order breaks ties
export function rankByUsage<T extends RankedBuilding>(buildings: readonly T[]): T[] {
    return buildings
        .map((building, index) => ({ building, index }))
        .sort((a, b) => (b.building.todayKwh ?? -1) - (a.building.todayKwh ?? -1) || a.index - b.index)
        .map(({ building }) => building);
}