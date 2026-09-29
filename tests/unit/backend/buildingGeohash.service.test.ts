import prisma from "../../../backend/core/src/lib/prisma";
import { updateBuildingService } from "../../../backend/core/src/services/building.services";
import { resolveCoordinates, computeGeohash } from "../../../backend/core/src/services/geocode.service";

jest.mock("../../../backend/core/src/lib/prisma", () => ({
    __esModule: true,
    default: {
        userBuildingAccess: { findUnique: jest.fn() },
        building: { findUnique: jest.fn(), update: jest.fn() }
    }
}));

jest.mock("../../../backend/core/src/services/geocode.service", () => ({
    resolveCoordinates: jest.fn(),
    computeGeohash: jest.fn(() => "computed8")
}));

jest.mock("../../../backend/core/src/services/provisioning.service", () => ({
    __esModule: true,
    queueBuildingProvisioning: jest.fn().mockResolvedValue(undefined),
    deleteInfluxBucket: jest.fn().mockResolvedValue(undefined)
}));

const store = prisma as unknown as {
    userBuildingAccess: { findUnique: jest.Mock };
    building: { findUnique: jest.Mock; update: jest.Mock };
};

const existing = {
    building_id: "b1",
    building_name: "Existing",
    physical_address: "1 Old Road",
    latitude: -25.75,
    longitude: 28.23,
    geohash: "oldhash",
    lifecycle_state: "ACTIVE",
    nominal_voltage: 230,
    max_current_threshold: 60,
    hardware_auth_token: "token"
};

const dataSentToPrisma = () => store.building.update.mock.calls[0][0].data;

describe("updateBuildingService geohash handling", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        store.building.findUnique.mockResolvedValue(existing);
        store.building.update.mockResolvedValue({});
        (computeGeohash as jest.Mock).mockReturnValue("computed8");
    });

    it("keeps the geohash which the caller sent instead of working out its own", async () => {
        await updateBuildingService("u1", "b1", {
            latitude: -33.9249,
            longitude: 18.4241,
            geohash: "k3vngp"
        } as any, "ADMIN");

        expect(dataSentToPrisma().geohash).toBe("k3vngp");
        expect(computeGeohash).not.toHaveBeenCalled();
    });

    it("leaves the stored geohash alone when nothing about the place changed", async () => {
        await updateBuildingService("u1", "b1", { building_name: "Renamed" } as any, "ADMIN");

        expect(computeGeohash).not.toHaveBeenCalled();
        expect(dataSentToPrisma().geohash).toBeUndefined();
    });

    it("works one out when the place moved and none was sent", async () => {
        await updateBuildingService("u1", "b1", {
            latitude: -33.9249,
            longitude: 18.4241
        } as any, "ADMIN");

        expect(computeGeohash).toHaveBeenCalledWith(-33.9249, 18.4241);
        expect(dataSentToPrisma().geohash).toBe("computed8");
    });


    it("still looks up a new address when the caller have not sent any coordinates", async () => {
        (resolveCoordinates as jest.Mock).mockResolvedValue({ latitude: -29.85, longitude: 31.02 });

        await updateBuildingService("u1", "b1", { physical_address: "2 New Road" } as any, "ADMIN");

        expect(resolveCoordinates).toHaveBeenCalledWith("2 New Road");
        expect(computeGeohash).toHaveBeenCalledWith(-29.85, 31.02);
    });
});