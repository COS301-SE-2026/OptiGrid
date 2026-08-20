import { applyRecommendation, viewRecommendationService, updateTariffService } from '../../../backend/core/src/services/recommendation.service';
import prisma from '../../../backend/core/src/lib/prisma';
import { analyticsQueue } from '../../../backend/core/src/services/bullmq';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        userBuildingAccess: {
            findFirst: jest.fn(),
        },
        optimisationRecommendation: {
            findUnique: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
        },
        building: {
            findUnique: jest.fn(),
        },
        utilityTariff: {
            findFirst: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
        }
    },
}));
jest.mock('../../../backend/core/src/services/bullmq', () => ({
    analyticsQueue: {
        add: jest.fn(),
    },
}));

describe("Recommendation Services Unit Tests", () => {
    beforeEach(() => {jest.clearAllMocks(); });

    it("should_successfully_apply_recommendation", async () => {
        (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({ user_id: "user-123", building_id: "build-123" });
        (prisma.optimisationRecommendation.findUnique as jest.Mock).mockResolvedValue({
            recommendation_id: "rec-123",
            building_id: "build-123",
            expires_at: new Date(Date.now() + 100000),
            strategy_description: "Test Strategy",
            applicable_range: {}
        });
        //act
        const out = await applyRecommendation("user-123", "build-123", "rec-123");
        //assert
        expect(out).toBe(true);
        expect(prisma.optimisationRecommendation.update).toHaveBeenCalledWith({
            where: { 
                recommendation_id: "rec-123" 
            },
            data: { 
                status: "Pending_Execution" 
            }
        });
        expect(analyticsQueue.add).toHaveBeenCalledWith("apply_recommendation", expect.any(Object));
    });

    it("should_throw_error_if_access_denied", async () => {
        (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue(null);
        //act n assert
        await expect(applyRecommendation("user-123", "build-123", "rec-123")).rejects.toThrow("Access Denied");
        expect(prisma.optimisationRecommendation.findUnique).not.toHaveBeenCalled();
    });

    it("should_throw_error_if_recommendation_not_found", async () => {
        (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({ user_id: "user-123", building_id: "build-123" });
        (prisma.optimisationRecommendation.findUnique as jest.Mock).mockResolvedValue(null);
        //act n assert
        await expect(applyRecommendation("user-123", "build-123", "rec-123")).rejects.toThrow("Recommendation not found");
    });

    it("should_throw_error_if_recommendation_expired", async () => {
        (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({ user_id: "user-123", building_id: "build-123" });
        (prisma.optimisationRecommendation.findUnique as jest.Mock).mockResolvedValue({
            recommendation_id: "rec-123",
            building_id: "build-123",
            expires_at: new Date(Date.now() - 100000),
            strategy_description: "Test Strategy",
            applicable_range: {}
        });
        //act
        await expect(applyRecommendation("user-123", "build-123", "rec-123")).rejects.toThrow("Expired");
        //assert
        expect(prisma.optimisationRecommendation.update).toHaveBeenCalledWith({
            where: { 
                recommendation_id: "rec-123" 
            },
            data: { 
                status: "Expired" 
            }
        });
        expect(analyticsQueue.add).not.toHaveBeenCalled();
    });

    describe("View Recommendation Unit Tests",  () => {
        it("should_return_rec", async () => {
            (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({ 
                user_id: "user123", 
                building_id: "building-123" 
            });
            (prisma.optimisationRecommendation.findMany as jest.Mock).mockResolvedValue([
                {
                    recommendation_id: "rec-123",
                    status: "Pending"
                }
            ]);
            //act
            const out = await viewRecommendationService("user123", "building-123", "Pending", 10);
            //assert
            expect(prisma.userBuildingAccess.findFirst).toHaveBeenCalledWith({
                where: {
                    user_id: "user123",
                    building_id: "building-123"
                }
            })
            expect(prisma.optimisationRecommendation.findMany).toHaveBeenCalledWith({
                where: {
                    building_id: "building-123",
                    status:"Pending"
                },
                take: 10,
                orderBy: {
                    expires_at: "desc"
                },
                select: expect.any(Object)
            });
            expect(out).toHaveLength(1);
        });

        it("should_throw_error_if_no_access", async () => {
            (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(viewRecommendationService("user-123", "building-123"))
            .rejects.toThrow("Access Denied");
            expect(prisma.optimisationRecommendation.findMany).not.toHaveBeenCalled();
        })
    });

    describe("Update Tariff Rates Unit Tests", () => {
        it("shiuld_create_tariff_if_noy_exist", async () => {
            (prisma.building.findUnique as jest.Mock).mockResolvedValue({ building_id: "building123" });
            (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue({ 
                user_id: "user-123", 
                building_id: "building123" 
            });

            (prisma.utilityTariff.findFirst as jest.Mock).mockResolvedValue(null);
            (prisma.utilityTariff.create as jest.Mock).mockResolvedValue(true);

            const payload = { 
                peak_rate_zar: 0.15, 
                off_peak_rate_zar: 0.08, 
                season_name: "Summer" 
            };
            //act
            const out = await updateTariffService("user-123", "building123", payload);
            //asset
            expect(out).toBe(true);
            expect(prisma.utilityTariff.create).toHaveBeenCalledWith({
                building_id: "building123",
                peak_rate_zae: 0.15, 
                off_peak_rate_zar: 0.08, 
                season_name: "Summer"
            });
            expect(prisma.utilityTariff.update).not.toHaveBeenCalled();
        });

        it("should_throw_an_error_if_no_building_exists", async ()=>{
            (prisma.building.findUnique as jest.Mock).mockResolvedValue(null);
            const payload = { 
                peak_rate_zar: 0.15, 
                off_peak_rate_zar: 0.08, 
                season_name: "Summer" 
            };
            //act n assert
            await expect(updateTariffService("user-123", "building123", payload))
            .rejects.toThrow("Building not found");
            expect(prisma.userBuildingAccess.findFirst).not.toHaveBeenCalled();
        });

        it("should_throw_error_if_no_access", async ( ) => {
            (prisma.building.findUnique as jest.Mock).mockResolvedValue({ building_id: "building123" });
            (prisma.userBuildingAccess.findFirst as jest.Mock).mockResolvedValue(null);
            const payload = { 
                peak_rate_zar: 0.15, 
                off_peak_rate_zar: 0.08, 
                season_name: "Summer" 
            };
            //act n assert
            await expect(updateTariffService("user-123", "build-123", payload))
            .rejects.toThrow("Access Denied");
            expect(prisma.utilityTariff.findFirst).not.toHaveBeenCalled();
        })
    });
});
