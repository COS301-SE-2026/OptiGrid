const mockMget = jest.fn();
const mockQueryRows = jest.fn();
const mockListSensorsForBuilding = jest.fn();

jest.mock('../../../backend/core/src/lib/redis', () => ({
    redis: { mget: (...args: unknown[]) => mockMget(...args) },
}));

jest.mock('../../../backend/core/src/services/sensor.services', () => ({
    listSensorsForBuilding: (...args: unknown[]) => mockListSensorsForBuilding(...args),
}));

jest.mock('@influxdata/influxdb-client', () => ({
    InfluxDB: jest.fn().mockImplementation(() => ({
        getQueryApi: jest.fn().mockReturnValue({
            queryRows: (...args: unknown[]) => mockQueryRows(...args),
        }),
    })),
}));

import { getLiveSensorReadings } from '../../../backend/core/src/services/liveTelemetry.service';

const buildingId = '00000000-0000-4000-8000-000000000001';
const firstSensorId = '00000000-0000-4000-8000-000000000011';
const secondSensorId = '00000000-0000-4000-8000-000000000012';

describe('live telemetry service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockListSensorsForBuilding.mockResolvedValue([
            { sensor_id: firstSensorId },
            { sensor_id: secondSensorId },
        ]);
    });

    it('returns cached readings without querying InfluxDB', async () => {
        const first = {
            building_id: buildingId,
            sensor_id: firstSensorId,
            power_kw: 12.4,
            timestamp: '2026-09-17T10:00:00.000Z',
        };
        const second = {
            building_id: buildingId,
            sensor_id: secondSensorId,
            power_kw: 8.1,
            timestamp: '2026-09-17T10:00:01.000Z',
        };
        mockMget.mockResolvedValue([JSON.stringify(first), JSON.stringify(second)]);

        await expect(getLiveSensorReadings('user-1', buildingId, 'VIEWER'))
            .resolves.toEqual([first, second]);

        expect(mockMget).toHaveBeenCalledWith(
            `sensor:last:${firstSensorId}`,
            `sensor:last:${secondSensorId}`,
        );
        expect(mockQueryRows).not.toHaveBeenCalled();
    });

    it('queries InfluxDB only for sensors missing from Redis', async () => {
        const cached = {
            building_id: buildingId,
            sensor_id: firstSensorId,
            power_kw: 12.4,
            timestamp: '2026-09-17T10:00:00.000Z',
        };
        mockMget.mockResolvedValue([JSON.stringify(cached), null]);
        mockQueryRows.mockImplementation((query: string, callbacks: any) => {
            expect(query).toContain(secondSensorId);
            expect(query).not.toContain(`sensor:last:${firstSensorId}`);
            callbacks.next([], {
                toObject: () => ({
                    sensor_id: secondSensorId,
                    _value: 9.6,
                    _time: '2026-09-17T10:00:02.000Z',
                }),
            });
            callbacks.complete();
        });

        await expect(getLiveSensorReadings('user-1', buildingId, 'VIEWER')).resolves.toEqual([
            cached,
            {
                building_id: buildingId,
                sensor_id: secondSensorId,
                power_kw: 9.6,
                timestamp: '2026-09-17T10:00:02.000Z',
            },
        ]);
    });

    it('propagates building access denial before reading telemetry', async () => {
        mockListSensorsForBuilding.mockRejectedValue(
            new Error('Access Denied. You do not have permission to access this building.'),
        );

        await expect(getLiveSensorReadings('user-1', buildingId, 'VIEWER'))
            .rejects.toThrow('Access Denied');
        expect(mockMget).not.toHaveBeenCalled();
    });

    it('returns an empty array when a building has no sensors', async () => {
        mockListSensorsForBuilding.mockResolvedValue([]);

        await expect(getLiveSensorReadings('user-1', buildingId, 'VIEWER')).resolves.toEqual([]);
        expect(mockMget).not.toHaveBeenCalled();
    });
});
