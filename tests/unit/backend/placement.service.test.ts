import { placeBuildingsFromAddress } from "../../../backend/core/src/services/placement.service";
import prisma from "../../../backend/core/src/lib/prisma";
import { resolveCoordinates } from "../../../backend/core/src/services/geocode.service";

jest.mock("../../../backend/core/src/lib/prisma", () => ({
    __esModule: true,
    default: {
        building: {
            findMany: jest.fn(),
            count: jest.fn(),
            update: jest.fn()
        }
    }
}));

jest.mock("../../../backend/core/src/services/geocode.service", () => ({
    resolveCoordinates: jest.fn(),
    computeGeohash: jest.fn(() => "kf8x9pqr")
}));

const findMany = prisma.building.findMany as jest.Mock;
const count = prisma.building.count as jest.Mock;
const update = prisma.building.update as jest.Mock;
const geocode = resolveCoordinates as jest.Mock;

describe("placeBuildingsFromAddress", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        update.mockResolvedValue({});
    });

    it("writes the coordinates and a geohash for every address which it resolves", async () => {
        findMany.mockResolvedValue([
            { building_id: "b1", building_name: "Hatfield Park", physical_address: "Hatfield, Pretoria" }
        ]);
        count.mockResolvedValue(1);
        geocode.mockResolvedValue({ latitude: -25.75, longitude: 28.23 });

        const result = await placeBuildingsFromAddress("user-1", "BUILDING_MANAGER", 1);

        expect(update).toHaveBeenCalledWith({
            where: { building_id: "b1" },
            data: { latitude: -25.75, longitude: 28.23, geohash: "kf8x9pqr" }
        });
        expect(result).toEqual({ placed: 1, failed: 0, remaining: 0, unresolved: [] });
    });

    it("reports the addresses it could not resolve without stopping", async () => {
        findMany.mockResolvedValue([
            { building_id: "b1", building_name: "Known Site", physical_address: "Hatfield, Pretoria" },
            { building_id: "b2", building_name: "Mystery Depot", physical_address: "nowhere at all" }
        ]);
        count.mockResolvedValue(2);
        geocode
            .mockResolvedValueOnce({ latitude: -25.75, longitude: 28.23 })
            .mockResolvedValueOnce(null);

        const result = await placeBuildingsFromAddress("user-1", "BUILDING_MANAGER", 2);

        expect(update).toHaveBeenCalledTimes(1);
        expect(result.placed).toBe(1);
        expect(result.failed).toBe(1);
        expect(result.unresolved).toEqual(["Mystery Depot"]);
        expect(result.remaining).toBe(1);
    });

    
    it("stick to the scope of buildings a manager is allowed to see", async () => {
        findMany.mockResolvedValue([]);
        count.mockResolvedValue(0);

        await placeBuildingsFromAddress("user-9", "BUILDING_MANAGER");

        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                authorized_users: { some: { user_id: "user-9" } },
                latitude: null
            })
        }));
    });

    it("leaves a blank address alone", async () => {
        findMany.mockResolvedValue([
            { building_id: "b1", building_name: "Blank Site", physical_address: "   " }
        ]);
        count.mockResolvedValue(1);

        const result = await placeBuildingsFromAddress("user-1", "BUILDING_MANAGER", 1);

        expect(geocode).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(result).toEqual({ placed: 0, failed: 1, remaining: 1, unresolved: ["Blank Site"] });
    });

    it("covers the whole portfolio for an administrator", async () => {
        findMany.mockResolvedValue([]);
        count.mockResolvedValue(0);

        await placeBuildingsFromAddress("user-9", "ADMIN");

        const where = findMany.mock.calls[0][0].where;
        expect(where.authorized_users).toBeUndefined();
        expect(where.latitude).toBeNull();
    });
});