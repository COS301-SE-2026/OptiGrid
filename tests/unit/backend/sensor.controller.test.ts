import { mock } from "node:test";
import { handleSensorTelemetry } from "../../../backend/core/src/controllers/sensor.controller";
import { forwardToIngestionService } from "../../../backend/core/src/services/sensor.services";
import {Request, Response} from 'express';

//mocking sensor service
jest.mock('../../../backend/core/src/services/sensor.services', () => ({
    __esModule: true,
    forwardToIngestionService: jest.fn(),
}));

const mockedForwardToIngestionService = forwardToIngestionService as jest.Mock;

describe('sensor controller unit tests', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
        jest.clearAllMocks();
        //setup mock response, mimicking express behaviour
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
    });

    it('returns a 400 error status if important telemetry tracking fields are missing', async () => {
        //Arrange
        mockReq = {
            body: {
                sensor_id: 'sensor-001'
            }
        };

        //Act
        await handleSensorTelemetry(mockReq as Request, mockRes as Response);

        //Assert
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
            status: 'error',
            message: 'Missing required telemetry fields'
        });
        expect(mockedForwardToIngestionService).not.toHaveBeenCalled();
    });

    it('successfully routes valid payload schemas down to the forwarding client pipeline', async () => {
        // Arrange
        mockReq = {
            body: {
                sensor_id: 'sensor-001',
                building_id: 'building-001',
                usage: '412.5'
            }
        };
        mockedForwardToIngestionService.mockResolvedValue({ status: 'success' });

        // Act
        await handleSensorTelemetry(mockReq as Request, mockRes as Response);

        // Assert
        expect(mockedForwardToIngestionService).toHaveBeenCalledWith(mockReq.body);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
            status: 'success',
            data: { status: 'success' },
        });
    });

    it('returns a 500 server error status code if downstream service links throw exceptions', async () => {
        // Arrange
        mockReq = {
            body: {
                sensor_id: 'sensor-001',
                building_id: 'building-001',
                usage: '125.0'
            }
        };
        mockedForwardToIngestionService.mockRejectedValue(new Error('Gateway Timeout Link Failure'));

        // Act
        await handleSensorTelemetry(mockReq as Request, mockRes as Response);

        // Assert
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
            status: 'error',
            message: 'Failed to process telemetry payload.'
        });
    });
});
