import { applyRecommendation } from '../../../backend/core/src/services/recommendation.service';
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
        },
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
});
