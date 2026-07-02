"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Building = {
    building_name: string;
    building_type: string;
    physical_address: string;
    square_footage: number | string;
    max_occupancy: number | string;
    timezone: string;
    geohash: string;
    latitude: number | string;
    longitude: number | string;
};

const initial: Building = {
    building_name: "",
    building_type: "",
    physical_address: "",
    square_footage: "",
    max_occupancy: "",
    timezone: "",
    geohash: "",
    latitude: "",
    longitude: "",
};

export default function ViewBuildingPage() {
    const { id } = useParams<{ id: string }>();

    const [building, setBuilding] = useState<Building>(initial);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState("");

    useEffect(() => {
        const loadBuilding = async () => {
            try {
                const res = await fetch(`/api/buildings/${id}`);

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data?.message ?? "failed to load building.");
                }

                setBuilding({
                    building_name: data.building_name ?? "",
                    building_type: data.building_type ?? "",
                    physical_address: data.physical_address ?? "",
                    square_footage: data.square_footage ?? "",
                    max_occupancy: data.max_occupancy ?? "",
                    timezone: data.timezone ?? "",
                    geohash: data.geohash ?? "",
                    latitude: data.latitude ?? "",
                    longitude: data.longitude ?? "",
                });
            } catch (err) {
                setApiError(
                    err instanceof Error
                        ? err.message
                        : "failed to load building."
                );
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            loadBuilding();
        }
    }, [id]);

    if (loading) {
        return <p>Loading...</p>;
    }

}