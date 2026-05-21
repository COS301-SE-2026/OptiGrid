import { forwardToIngestionService } from '../../../backend/core/src/services/sensor.services';

describe('sensor service unit tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test Case 1: Verifies successful network handshake and JSON resolution
    it('forwards telemetry data successfully when the Ingestion API returns 200 OK', async () => {
        // Arrange
        const mockPayload = {
            sensor_id: 'sensor-001',
            building_id: 'building-001',
            usage: '412.5'
        };
        const mockApiResponse = { status: 'success', message: 'Data buffered' };

        // mock global fetch response
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockApiResponse),
        });

        // Act
        const result = await forwardToIngestionService(mockPayload);

        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mockPayload),
            })
        );
        expect(result).toEqual(mockApiResponse);
    });

    //Test Case: Validates strict error classification on status code 500
    it('throws a structured error when the Ingestion API responds with a non-ok status code', async () => {
        // Arrange
        const mockPayload = { sensor_id: 'sensor-001', building_id: 'building-001', usage: '412.5' };

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
        });

        // Act and Assert
        await expect(forwardToIngestionService(mockPayload)).rejects.toThrow(
            'Ingestion API responded with status: 500'
        );
    });

    //Test Case 3: Edge case checking handling malformed or non-JSON payloads
    it('throws and error if Ingestion API responds with 200 but invalid payloads', async () => {
        const mockPayload = { sensor_id: 'sensor-001', building_id: 'building-001', usage: '10.0' };

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockRejectedValue(new Error('Unexpected token < in JSON at position 0')),
        });

        await expect(forwardToIngestionService(mockPayload)).rejects.toThrow('Unexpected token < in JSON at position 0');
    }); 

    //Test Case 4: Edge case covering a complete downstream pipeline drop, causing fetch to throw infrastructure error
    it('catches and escalates underlying system-level network connection drop errors', async () => {
        const mockPayload = { sensor_id: 'sensor-001', building_id: 'building-001', usage: '100.0' };

        global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));

        await expect(forwardToIngestionService(mockPayload)).rejects.toThrow('fetch failed');
    });
});