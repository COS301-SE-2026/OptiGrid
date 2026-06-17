import './setup-env';

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://integration-test.supabase.local';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'integration-service-role-key';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? 'integration-anon-key';

jest.mock('@supabase/supabase-js', () => {
	const { randomUUID } = require('node:crypto');
	const authUsersByEmail = new Map<string, { id: string; email: string; password: string }>();
	const authUsersById = new Map<string, { id: string; email: string; password: string }>();

	function normalizeEmail(email: string) {
		return email.trim().toLowerCase();
	}

	return {
		__esModule: true,
		createClient: jest.fn(() => ({
			auth: {
				admin: {
					createUser: jest.fn(async ({ email, password }: { email: string; password: string }) => {
						const normalizedEmail = normalizeEmail(email);
						if (authUsersByEmail.has(normalizedEmail)) {
							return {
								data: { user: null },
								error: { code: 'user_already_exists', message: 'User already exists' },
							};
						}

						const user = { id: randomUUID(), email: normalizedEmail, password };
						authUsersByEmail.set(normalizedEmail, user);
						authUsersById.set(user.id, user);

						return {
							data: { user: { id: user.id, email: user.email } },
							error: null,
						};
					}),
					deleteUser: jest.fn(async (userId: string) => {
						const user = authUsersById.get(userId);
						if (user) {
							authUsersById.delete(userId);
							authUsersByEmail.delete(normalizeEmail(user.email));
						}

						return { error: null };
					}),
				},
				signInWithPassword: jest.fn(async ({ email, password }: { email: string; password: string }) => {
					const user = authUsersByEmail.get(normalizeEmail(email));
					if (!user || user.password !== password) {
						return {
							data: { user: null, session: null },
							error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
						};
					}

					return {
						data: {
							user: { id: user.id, email: user.email, user_metadata: {} },
							session: { access_token: `integration-token:${user.id}` },
						},
						error: null,
					};
				}),
				getUser: jest.fn(async (token: string) => {
					const userId = token.startsWith('integration-token:') ? token.slice('integration-token:'.length) : '';
					const user = authUsersById.get(userId);
					if (!user) {
						return {
							data: { user: null },
							error: { code: 'invalid_token', message: 'Invalid token' },
						};
					}

					return {
						data: { user: { id: user.id, email: user.email, user_metadata: {} } },
						error: null,
					};
				}),
			},
		})),
	};
});
