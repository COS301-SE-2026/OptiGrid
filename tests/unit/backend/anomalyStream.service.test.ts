import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import prisma from '../../../backend/core/src/lib/prisma';
import { addAnomalyListener, publishAnomaly } from '../../../backend/core/src/services/anomalyStream.service';
import { streamAnomalies } from '../../../backend/core/src/controllers/anomaly.controller';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		userBuildingAccess: {
			findMany: jest.fn(),
		},
	},
}));

function createResponse(): Response & EventEmitter {
	const response = new EventEmitter() as Response & EventEmitter;
	response.write = jest.fn().mockReturnValue(true);
	response.setHeader = jest.fn();
	response.flushHeaders = jest.fn();
	response.status = jest.fn().mockReturnValue(response);
	response.json = jest.fn().mockReturnValue(response);
	return response;
}

function alertsWritten(response: Response): unknown[] {
	return (response.write as jest.Mock).mock.calls
		.map(([chunk]) => String(chunk))
		.filter((chunk) => chunk.startsWith('data: '))
		.map((chunk) => JSON.parse(chunk.slice(6)));
}

const anomaly = { anomaly_id: 'anomaly-1', building_id: 'building-1', building_name: 'Sandton Mall' };

describe('anomaly stream', () => {
	const openResponses: Array<Response & EventEmitter> = [];

	function listen(userId: string, roleType: string) {
		const response = createResponse();
		openResponses.push(response);
		addAnomalyListener(userId, roleType, response);
		return response;
	}

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		openResponses.splice(0).forEach((response) => response.emit('close'));
		jest.useRealTimers();
	});

	it('sends the anomaly to users assigned to the building and to admins', async () => {
		(prisma.userBuildingAccess.findMany as jest.Mock).mockResolvedValue([{ user_id: 'manager-1' }]);
		const manager = listen('manager-1', 'BUILDING_MANAGER');
		const admin = listen('admin-1', 'ADMIN');

		await publishAnomaly('building-1', anomaly);

		const expected = [{ event: 'ANOMALY_DETECTED', payload: anomaly }];
		expect(alertsWritten(manager)).toEqual(expected);
		expect(alertsWritten(admin)).toEqual(expected);
		expect(prisma.userBuildingAccess.findMany).toHaveBeenCalledWith({
			where: { building_id: 'building-1' },
			select: { user_id: true },
		});
	});

	it('keeps the anomaly away from users who have no access to the building', async () => {
		(prisma.userBuildingAccess.findMany as jest.Mock).mockResolvedValue([{ user_id: 'manager-1' }]);
		const outsider = listen('viewer-2', 'VIEWER');

		await publishAnomaly('building-1', anomaly);

		expect(alertsWritten(outsider)).toEqual([]);
	});

	it('stops sending as soon as the browser disconnects', async () => {
		(prisma.userBuildingAccess.findMany as jest.Mock).mockResolvedValue([{ user_id: 'viewer-1' }]);
		const viewer = listen('viewer-1', 'VIEWER');
		viewer.emit('close');

		await publishAnomaly('building-1', anomaly);

		expect(alertsWritten(viewer)).toEqual([]);
	});

	it('refuses a request without a signed in user', () => {
		const response = createResponse();

		streamAnomalies({} as any, response);

		expect(response.status).toHaveBeenCalledWith(401);
		expect(response.setHeader).not.toHaveBeenCalled();
	});

	it('opens an event stream for a signed in user', () => {
		const response = createResponse();
		openResponses.push(response);

		streamAnomalies({ user: { id: 'viewer-1', roleType: 'VIEWER' } } as any, response);

		expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
		expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
		expect(response.flushHeaders).toHaveBeenCalled();
		expect(response.write).toHaveBeenCalledWith(': connected\n\n');
	});

});