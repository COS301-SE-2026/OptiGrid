import type {
    Building,
    BuildingsResponse,
    ComparisonData,
    ComparisonResponse,
    RawBuilding,
    TimeRange,
} from "./types";

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function mapBuilding(row: RawBuilding): Building {
    const id = typeof row.building_id === "string" ? row.building_id : "";
    const name =
        typeof row.building_name === "string" && row.building_name.trim().length > 0
            ? row.building_name
            : "Unnamed building";

    return {
        id,
        name,
        squareFootage: toFiniteNumber(row.square_footage),
    };
}

export async function fetchBuildings(): Promise<Building[]> {
    const response = await fetch("/api/buildings", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as BuildingsResponse;
    if (!response.ok) {
        throw new Error(payload.message || "Unable to load buildings.");
    }

    const rows = Array.isArray(payload.data) ? (payload.data as RawBuilding[]) : [];
    return rows.map(mapBuilding).filter((building) => building.id.length > 0);
}

export async function fetchComparison(
    buildingA: string,
    buildingB: string,
    dateRange: TimeRange,
): Promise<ComparisonData> {
    const params = new URLSearchParams({
        building_id_a: buildingA,
        building_id_b: buildingB,
        time_range: `${dateRange}d`,
    });

    const response = await fetch(`/api/buildings/compare?${params.toString()}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as ComparisonResponse;
    if (!response.ok || !payload.data) {
        throw new Error(payload.message || "Unable to compare buildings.");
    }

    return payload.data;
}
