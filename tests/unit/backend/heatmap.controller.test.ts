import { Request, Response } from "express";
import { getHeatmapController } from "../../../backend/core/src/controllers/heatmap.controller";
import * as heatmapService from "../../../backend/core/src/services/heatmap.service";

jest.mock("../../../backend/core/src/services/heatmap.service");
jest.mock("../../../backend/core/src/lib/prisma", () => ({
    __esModule: true,
    default: {}
}));

describe("Heatmap Controller Unit Tests", () => {
    let req: Partial<Request>;
    let resp: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({
            json: jsonMock
        });
        req = {
            user: {
                userId: "user-123"
            } as any,
            query: {
                timeframe: "live"
            }
        };
        resp = {
            status: statusMock,
            json: jsonMock
        };
        jest.clearAllMocks();
    });

    it("should_return_200_n_heatmap_data", async () => {
        const mockData = {
            timeframe: "live",
            unit: "kW",
            generated_at: "now",
            points: []
        };
        (heatmapService.getHeatmapDataService as jest.Mock).mockResolvedValue(mockData);
        //act
        await getHeatmapController(req as Request, resp as Response);
        //assert
        expect(heatmapService.getHeatmapDataService).toHaveBeenCalledWith("user-123", "live");
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
            status: "success",
            data: mockData
        });
    });

    it("should_retunr_401", async () => {
        req.user = undefined;
        //act
        await getHeatmapController(req as Request, resp as Response);
        //assert
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(jsonMock).toHaveBeenCalledWith({ status: "error", message: "Unauthorized" });
    });

    it("should_return_400", async () => {
        req.query = {
            timeframe: "wrong"
        };
        //act
        await getHeatmapController(req as Request, resp as Response);
        //assert
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
            status: "error",
            message: "Invalid timeframe"
        });
    });

    it("should_return_500", async () => {
        (heatmapService.getHeatmapDataService as jest.Mock).mockRejectedValue(new Error("Error"));
        //act
        await getHeatmapController(req as Request, resp as Response);
        //assert
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
            status: "error",
            message: "Internal Server Error"
        });
    });
});
