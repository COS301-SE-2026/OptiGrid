import type { Client } from 'pg';

export const integrationPasswordHash =
	'$2b$10$2h2mZKoDbJkWBk4x9swFZeF7Ojf9SIxkV8W8QhQPXfS9M9iYjW0uS';

export type IntegrationUserFixture = {
	userId: string;
	tenantId?: string | null;
	email: string;
	passwordHash?: string;
	firstName?: string | null;
	lastName?: string | null;
};

async function hasPasswordHashColumn(client: Client): Promise<boolean> {
	const result = await client.query(
		`select 1
		 from information_schema.columns
		 where table_schema = 'public'
		   and table_name = 'users'
		   and column_name = 'password_hash'
		 limit 1`,
	);

	return result.rowCount > 0;
}

export async function insertIntegrationUsers(client: Client, users: IntegrationUserFixture[]): Promise<void> {
	if (users.length === 0) {
		return;
	}

	const includePasswordHash = await hasPasswordHashColumn(client);
	const columns = ['user_id', 'tenant_id', 'email', 'first_name', 'last_name'];
	if (includePasswordHash) {
		columns.splice(3, 0, 'password_hash');
	}

	const values: unknown[] = [];
	const rows = users.map((user) => {
		const rowValues = [
			user.userId,
			user.tenantId ?? null,
			user.email,
			user.firstName ?? null,
			user.lastName ?? null,
		];

		if (includePasswordHash) {
			rowValues.splice(3, 0, user.passwordHash ?? integrationPasswordHash);
		}

		const placeholders = rowValues.map((value) => {
			values.push(value);
			return `$${values.length}`;
		});

		return `(${placeholders.join(', ')})`;
	});

	await client.query(
		`insert into users (${columns.join(', ')})
		 values ${rows.join(', ')}
		 on conflict (user_id) do nothing`,
		values,
	);
}
