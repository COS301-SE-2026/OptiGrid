/** @jest-environment node */

import { GET } from './route';

describe('carbon integrity proxy', () => {
    beforeEach(() => {
        process.env.CORE_URL = 'http://core.test';
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ status: 'success', data: { status: 'VALID' } })
        }) as jest.Mock;
    });

    it('forwards the building, month, and authentication to core', async () => {
        const request = new Request(
            'http://localhost/api/compliance/carbon-integrity?building_id=building-1&month=2026-09&ignored=true',
            {
                headers: {
                    cookie: 'optigrid_access_token=test-token; optigrid_session=session-value'
                }
            }
        );
        const response = await GET(request);
        expect(response.status).toBe(200);

        const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toBe('http://core.test/api/compliance/carbon-integrity?building_id=building-1&month=2026-09');
        expect(options.method).toBe('GET');
        expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token');
    });

    it('rejects requests without a session', async () => {
        const response = await GET(new Request('http://localhost/api/compliance/carbon-integrity'));
        expect(response.status).toBe(401);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
