import cron from 'node-cron';
import prisma from '../../../backend/core/src/lib/prisma';
import { dispatchAnomalyNotification } from '../../../backend/core/src/services/notification.service';
import { startEscalationWorker } from '../../../backend/core/src/workers/escalation.worker';

jest.mock('node-cron', () => ({
    schedule: jest.fn(),
}));

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    anomaly: {
        findMany: jest.fn(),
        update: jest.fn(),
    },
}));

jest.mock('../../../backend/core/src/services/notification.service', () => ({
    dispatchAnomalyNotification: jest.fn(),
}));

describe('Escalation Worker', () => {
    let cronCallback: Function;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // mock the cron.schedule to capture the callback
        (cron.schedule as jest.Mock).mockImplementation((_expression, callback) => {
            cronCallback = callback;
            return { start: jest.fn(), stop: jest.fn() };
        });

        // set a fixed date for reliable 24h logic testing
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should schedule a task to run hourly', () => {
        startEscalationWorker();
        expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
    });

    it('should not update anything if there are no prolonged anomalies', async () => {
        startEscalationWorker();
        
        (prisma.anomaly.findMany as jest.Mock).mockResolvedValue([]);

        await cronCallback();

        expect(prisma.anomaly.findMany).toHaveBeenCalledTimes(1);
        
        // check the query arguments to ensure it filters correctly
        const callArg = (prisma.anomaly.findMany as jest.Mock).mock.calls[0][0];
        expect(callArg.where.status).toBe('Open');
        expect(callArg.where.escalation_level).toBe(0);
        expect(callArg.where.detected_timestamp.lte).toBeInstanceOf(Date);
        expect(callArg.where.detected_timestamp.lte.toISOString()).toBe('2026-08-14T12:00:00.000Z');

        expect(prisma.anomaly.update).not.toHaveBeenCalled();
        expect(dispatchAnomalyNotification).not.toHaveBeenCalled();
    });

    it('should escalate prolonged anomalies to Critical and dispatch notifications', async () => {
        startEscalationWorker();

        const mockAnomalies = [
            {
                anomaly_id: 'anomaly-1',
                building_id: 'bldg-1',
                anomaly_type: 'POWER_USAGE',
                z_score_value: 2.5,
                status: 'Open',
                escalation_level: 0,
            },
            {
                anomaly_id: 'anomaly-2',
                building_id: 'bldg-2',
                anomaly_type: 'CURRENT_USAGE',
                z_score_value: null, // test fallback to 0
                status: 'Open',
                escalation_level: 0,
            }
        ];

        (prisma.anomaly.findMany as jest.Mock).mockResolvedValue(mockAnomalies);
        (prisma.anomaly.update as jest.Mock).mockResolvedValue({});

        await cronCallback();

        expect(prisma.anomaly.update).toHaveBeenCalledTimes(2);

        // verify update for anomaly 1
        expect(prisma.anomaly.update).toHaveBeenNthCalledWith(1, {
            where: { anomaly_id: 'anomaly-1' },
            data: { escalation_level: 1, severity_level: 'critical' },
        });

        // verify update for anomaly 2
        expect(prisma.anomaly.update).toHaveBeenNthCalledWith(2, {
            where: { anomaly_id: 'anomaly-2' },
            data: { escalation_level: 1, severity_level: 'critical' },
        });

        expect(dispatchAnomalyNotification).toHaveBeenCalledTimes(2);

        // verify notification for anomaly 1
        expect(dispatchAnomalyNotification).toHaveBeenNthCalledWith(
            1,
            'anomaly-1',
            'bldg-1',
            'POWER_USAGE',
            2.5,
            0,
            'critical'
        );

        // verify notification for anomaly 2 (with fallback z score = 0)
        expect(dispatchAnomalyNotification).toHaveBeenNthCalledWith(
            2,
            'anomaly-2',
            'bldg-2',
            'CURRENT_USAGE',
            0,
            0,
            'critical'
        );
    });

    it('should handle errors gracefully during the sweep', async () => {
        startEscalationWorker();
        
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('Database connection failed');
        (prisma.anomaly.findMany as jest.Mock).mockRejectedValue(error);

        await cronCallback();

        expect(prisma.anomaly.update).not.toHaveBeenCalled();
        expect(dispatchAnomalyNotification).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('[EscalationWorker] Error during sweep:', error);
        
        consoleErrorSpy.mockRestore();
    });
});
