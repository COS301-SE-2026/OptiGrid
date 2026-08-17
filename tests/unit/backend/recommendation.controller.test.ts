import { applyRecommendationController } from "../../../backend/core/src/controllers/recommendation.controller";
import { applyRecommendation } from "../../../backend/core/src/services/recommendation.service";
import { Request, Response } from "express";

jest.mock("../../../backend/core/src/services/recommendation.service");

describe("Recommendation Controller Unit Tests", () => {
    let req: Partial<Request>;
    let resp: Partial<Response>;
    let mockstatus: jest.Mock;
    let json: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        json = jest.fn();
        mockstatus = jest.fn().mockReturnValue({ json: json });
        resp = {
            status: mockstatus,
        };
    });

    it("should_return_200_when_recommendation_applied_successfully", async () => {
        req = {
            user: { 
                id: "user-123", 
                roleType: "ADMIN" 
            } as any,
            params: {
                building_id: "build-123",
                recommendation_id: "rec-123"
            }
        };
        (applyRecommendation as jest.Mock).mockResolvedValue(true);
        //act
        await applyRecommendationController(req as Request, resp as Response);
        //assert
        expect(applyRecommendation).toHaveBeenCalledWith("user-123", "build-123", "rec-123");
        expect(mockstatus).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith({
            status: "success",
            message: "Recommendation applied successfully"
        });
    });

    it("should_return_401_if_user_not_authenticated", async () => {
        req = {
            user: undefined,
            params: {
                building_id: "build-123",
                recommendation_id: "rec-123"
            }
        };
        //act
        await applyRecommendationController(req as Request, resp as Response);
        //assert
        expect(applyRecommendation).not.toHaveBeenCalled();
        expect(mockstatus).toHaveBeenCalledWith(401);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ 
            status: "error", 
            message: "Unauthorised" 
        }));
    });

    it("should_return_403_if_user_is_viewer", async () => {
        req = {
            user: { 
                id: "user-123", 
                roleType: "VIEWER" 
            } as any,
            params: {
                building_id: "build-123",
                recommendation_id: "rec-123"
            }
        };
        //act
        await applyRecommendationController(req as Request, resp as Response);
        //assert
        expect(applyRecommendation).not.toHaveBeenCalled();
        expect(mockstatus).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
    });

    it("should_return_404_when_recommendation_not_found", async () => {
        req = {
            user: { 
                id: "user-123", 
                roleType: "BUILDING_MANAGER" 
            } as any,
            params: {
                building_id: "build-123",
                recommendation_id: "rec-123"
            }
        };
        (applyRecommendation as jest.Mock).mockRejectedValue(new Error("Recommendation not found"));
        //act
        await applyRecommendationController(req as Request, resp as Response);
        //assert
        expect(mockstatus).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ 
            status: "error", 
            message: "Recommendation not found" 
        }));
    });

    it("should_return_409_when_recommendation_expired", async () => {
        req = {
            user: { 
                id: "user-123", 
                roleType: "ADMIN" 
            } as any,
            params: {
                building_id: "build-123",
                recommendation_id: "rec-123"
            }
        };
        (applyRecommendation as jest.Mock).mockRejectedValue(new Error("Expired"));
        //act
        await applyRecommendationController(req as Request, resp as Response);
        //assert
        expect(mockstatus).toHaveBeenCalledWith(409);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
    });

    it("should_return_500_on_internal_server_error", async () => {
        req = {
            user: { 
                id: "user-123", 
                roleType: "ADMIN" 
            } as any,
            params: {
                building_id: "build-123",
                recommendation_id: "rec-123"
            }
        };
        (applyRecommendation as jest.Mock).mockRejectedValue(new Error("SOme error"));
        //act
        await applyRecommendationController(req as Request, resp as Response);
        //assert
        expect(mockstatus).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ 
            status: "error", 
            message: "Internal server error" 
        }));
    });
});
