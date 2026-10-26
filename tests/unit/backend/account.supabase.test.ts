import http, { type IncomingMessage, type ServerResponse } from 'http';
import type { AddressInfo } from 'net';
import prisma from '../../../backend/core/src/lib/prisma';
import {
    changePassword,
    getAccountOverview,
    signOutEverywhere,
} from '../../../backend/core/src/services/account.services';

// The real supabase-js client is used here and only the Auth server is replaced
// These tests check the exact requests the account service sends
// Like Supabase Auth, the fake server keeps only the calling session when a password changes
jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn() },
    },
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'thandi@example.com';
const USER_TOKEN = 'user-session-token';
const OTHER_DEVICE_TOKEN = 'other-device-token';
const SESSION_GONE = { code: 403, error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' };

type RecordedRequest = {
    method: string;
    path: string;
    authorization: string | undefined;
    body: Record<string, unknown> | null;
};

const fakeAuth = {
    password: 'OldPass123!',
    providers: ['email'],
    verificationCount: 0,
    sessions: new Set<string>(),
    requests: [] as RecordedRequest[],
};

function authUser() {
    return {
        id: USER_ID,
        aud: 'authenticated',
        role: 'authenticated',
        email: EMAIL,
        last_sign_in_at: '2026-10-25T07:58:12.000Z',
        app_metadata: { provider: fakeAuth.providers[0], providers: fakeAuth.providers },
        user_metadata: {},
        identities: fakeAuth.providers.map((provider) => ({ provider })),
        created_at: '2026-03-02T08:15:00.000Z',
    };
}

function send(res: ServerResponse, status: number, payload?: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(payload === undefined ? '' : JSON.stringify(payload));
}

function liveSession(authorization: string | undefined) {
    const token = authorization?.replace(/^Bearer /, '') ?? '';
    return fakeAuth.sessions.has(token) ? token : null;
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(chunk as Buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return text ? JSON.parse(text) : null;
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const body = await readBody(req);
    const authorization = req.headers.authorization;
    fakeAuth.requests.push({ method: req.method ?? '', path: `${url.pathname}${url.search}`, authorization, body });

    if (req.method === 'GET' && url.pathname === '/auth/v1/user') {
        return liveSession(authorization) ? send(res, 200, authUser()) : send(res, 403, SESSION_GONE);
    }

    if (req.method === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
        if (body?.email !== EMAIL || body?.password !== fakeAuth.password) {
            return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        }
        fakeAuth.verificationCount += 1;
        const token = `verification-${fakeAuth.verificationCount}`;
        fakeAuth.sessions.add(token);
        return send(res, 200, {
            access_token: token,
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: 'refresh-token',
            user: authUser(),
        });
    }

    if (req.method === 'PUT' && url.pathname === '/auth/v1/user') {
        const caller = liveSession(authorization);
        if (!caller) {
            return send(res, 403, SESSION_GONE);
        }
        if (body?.password === fakeAuth.password) {
            return send(res, 422, { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' });
        }
        fakeAuth.password = String(body?.password);
        fakeAuth.sessions = new Set([caller]);
        return send(res, 200, authUser());
    }

    if (req.method === 'POST' && url.pathname === '/auth/v1/logout') {
        const caller = liveSession(authorization);
        if (!caller) {
            return send(res, 403, SESSION_GONE);
        }
        const scope = url.searchParams.get('scope') ?? 'global';
        if (scope === 'local') {
            fakeAuth.sessions.delete(caller);
        } else if (scope === 'others') {
            fakeAuth.sessions = new Set([caller]);
        } else {
            fakeAuth.sessions.clear();
        }
        return send(res, 204);
    }

    return send(res, 404, { msg: 'not found' });
});

const mockedFindUnique = prisma.user.findUnique as unknown as jest.Mock;
const originalEnv = process.env;

beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    process.env = {
        ...originalEnv,
        SUPABASE_URL: `http://127.0.0.1:${port}`,
        SUPABASE_ANON_KEY: 'anon-key',
    };
});

afterAll(async () => {
    process.env = originalEnv;
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
    fakeAuth.password = 'OldPass123!';
    fakeAuth.providers = ['email'];
    fakeAuth.verificationCount = 0;
    fakeAuth.sessions = new Set([USER_TOKEN, OTHER_DEVICE_TOKEN]);
    fakeAuth.requests = [];
    mockedFindUnique.mockReset();
});

function calls() {
    return fakeAuth.requests.map(({ method, path, authorization }) => `${method} ${path} ${authorization ?? ''}`);
}

describe('account service against Supabase Auth', () => {
    it('checks the password in its own session and sends the change from this device, which stays signed in', async () => {
        await expect(changePassword(USER_ID, USER_TOKEN, {
            currentPassword: 'OldPass123!',
            newPassword: 'NewPass456!',
        })).resolves.toBeUndefined();

        expect(fakeAuth.password).toBe('NewPass456!');
        expect(calls()).toEqual([
            `GET /auth/v1/user Bearer ${USER_TOKEN}`,
            'POST /auth/v1/token?grant_type=password Bearer anon-key',
            'POST /auth/v1/logout?scope=local Bearer verification-1',
            `PUT /auth/v1/user Bearer ${USER_TOKEN}`,
        ]);
        expect(fakeAuth.requests[1].body).toMatchObject({ email: EMAIL, password: 'OldPass123!' });
        expect(fakeAuth.requests[3].body).toEqual({ password: 'NewPass456!' });
        expect([...fakeAuth.sessions]).toEqual([USER_TOKEN]);
    });

    it('rejects a wrong current password before any change is sent', async () => {
        await expect(changePassword(USER_ID, USER_TOKEN, {
            currentPassword: 'WrongPass1!',
            newPassword: 'NewPass456!',
        })).rejects.toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });

        expect(fakeAuth.password).toBe('OldPass123!');
        expect(calls().some((call) => call.startsWith('PUT'))).toBe(false);
    });

    it('turns the Supabase same_password reply into a clear error', async () => {
        await expect(changePassword(USER_ID, USER_TOKEN, {
            currentPassword: 'OldPass123!',
            newPassword: 'OldPass123!',
        })).rejects.toMatchObject({ code: 'SAME_PASSWORD' });

        expect(calls()).toContain('POST /auth/v1/logout?scope=local Bearer verification-1');
        expect([...fakeAuth.sessions]).toEqual([USER_TOKEN, OTHER_DEVICE_TOKEN]);
    });

    it('refuses to change the password of a Google account', async () => {
        fakeAuth.providers = ['google'];

        await expect(changePassword(USER_ID, USER_TOKEN, {
            currentPassword: 'OldPass123!',
            newPassword: 'NewPass456!',
        })).rejects.toMatchObject({ code: 'PASSWORD_NOT_AVAILABLE' });

        expect(calls()).toEqual([`GET /auth/v1/user Bearer ${USER_TOKEN}`]);
    });

    it('ends every session with one global logout call', async () => {
        await signOutEverywhere(USER_TOKEN);

        expect(calls()).toEqual([`POST /auth/v1/logout?scope=global Bearer ${USER_TOKEN}`]);
    });

    it('reads the sign-in methods for the settings page', async () => {
        fakeAuth.providers = ['email', 'google'];
        mockedFindUnique.mockResolvedValue({
            userId: USER_ID,
            email: EMAIL,
            firstName: 'Thandi',
            lastName: 'Mokoena',
            roleType: 'VIEWER',
            preferredTheme: 'DARK',
            createdAt: new Date('2026-03-02T08:15:00.000Z'),
            updatedAt: new Date('2026-03-02T08:15:00.000Z'),
        });

        const overview = await getAccountOverview(USER_ID, USER_TOKEN);

        expect(overview.security).toEqual({
            signInMethods: ['email', 'google'],
            canChangePassword: true,
            lastSignInAt: '2026-10-25T07:58:12.000Z',
        });
        expect(overview.user.preferredTheme).toBe('dark');
    });
});