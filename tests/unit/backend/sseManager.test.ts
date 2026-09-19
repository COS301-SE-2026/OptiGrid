import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { sseManager } from '../../../backend/core/src/utils/sseManager';

function createResponse(): Response & EventEmitter {
    const response = new EventEmitter() as Response & EventEmitter;
    response.write = jest.fn().mockReturnValue(true);
    return response;
}

describe('SSEManager', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('sends a heartbeat every 20 seconds', () => {
        const response = createResponse();
        sseManager.addClient('building-1', response);

        expect(response.write).toHaveBeenCalledWith(': connected\n\n');
        jest.advanceTimersByTime(20_000);
        expect(response.write).toHaveBeenCalledWith(': keep-alive\n\n');

        response.emit('close');
    });

    it('stops heartbeats and broadcasts after the connection closes', () => {
        const response = createResponse();
        sseManager.addClient('building-2', response);
        response.emit('close');
        jest.clearAllMocks();

        jest.advanceTimersByTime(40_000);
        sseManager.broadcast('building-2', { power_kw: 12.4 });

        expect(response.write).not.toHaveBeenCalled();
    });
});
