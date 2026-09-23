import prisma from "../lib/prisma";
import { resolveCoordinates, computeGeohash } from "./geocode.service";

export const BATCH_SIZE = 5;
const GAP_MS = 1100;

export type PlacementResult = {
    placed: number;
    failed: number;
    remaining: number;
    unresolved: string[];
};

const wait = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

export const placeBuildingsFromAddress = async (userId: string, role?: string, batchSize = BATCH_SIZE): Promise<PlacementResult> => {
    const scope = role === "ADMIN" ? {} : { authorized_users: { some: { user_id: userId } } };
    const where = {
        ...scope,
        latitude: null,
        physical_address: {
            not: null
        }
    };

    const pending = await prisma.building.findMany({
        where,
        select: {
            building_id: true,
            building_name: true,
            physical_address: true
        },
        orderBy: {
            created_at: "asc" as const
        },
        take: batchSize
    });

    const total = await prisma.building.count({ where });

    let placed = 0;
    const unresolved: string[] = [];

    for (let index = 0; index < pending.length; index++) {
        const building = pending[index];
        const address = building.physical_address?.trim();
        if (!address) {
            unresolved.push(building.building_name);
            continue;
        }

        if (index > 0) {
            await wait(GAP_MS);
        }

        const coords = await resolveCoordinates(address);
        if (!coords) {
            unresolved.push(building.building_name);
            continue;
        }

        await prisma.building.update({
            where: {
                building_id: building.building_id
            },
            data: {
                latitude: coords.latitude,
                longitude: coords.longitude,
                geohash: computeGeohash(coords.latitude, coords.longitude)
            }
        });
        placed++;
    }

    return {
        placed,
        failed: unresolved.length,
        remaining: Math.max(0, total - placed),
        unresolved
    };
};