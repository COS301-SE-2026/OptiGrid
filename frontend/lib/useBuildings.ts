import { useQuery } from "@tanstack/react-query";

type BuildingApiRecord = {
    building_id: string;
    building_name: string;
    today_kwh?: unknown;
};

export type Building = {
    id: string;
    name: string;
    todayKwh?: number | null;
};

function toUsage(value: unknown): number | null {
    const usage = typeof value === "string" ? Number(value) : value;
    return typeof usage === "number" && Number.isFinite(usage) ? usage : null;
}

// this is a shared loader for the building picker used by the forecast and insights and esg views
export function useBuildings() {
    return useQuery<Building[]>({
        queryKey: ["buildings", "picker"],
        queryFn: async () => {
            const response = await fetch("/api/buildings", {
                method: "GET",
                credentials: "include",
                cache: "no-store",
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || "Unable to load buildings.");
            }

            const buildingRecords = Array.isArray(payload?.data) ? payload.data : [];
            return buildingRecords.map((building: BuildingApiRecord) => ({
                id: building.building_id,
                name: building.building_name,
                todayKwh: toUsage(building.today_kwh),
            }));
        },
    });
}