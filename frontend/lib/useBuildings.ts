import { useQuery } from "@tanstack/react-query";

type BuildingApiRecord = {
    building_id: string;
    building_name: string;
};

export type Building = {
    id: string;
    name: string;
};

// this is a shared loader for the building picker used by the forecastt and insights views
export function useBuildings() {
    return useQuery<Building[]>({
        queryKey: ["buildings"],
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
            }));
        },
    });
}