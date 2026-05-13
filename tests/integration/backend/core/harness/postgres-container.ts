import { randomUUID } from 'crypto';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

export interface StartedPostgresHarness {
	connectionString: string;
	container: StartedTestContainer;
	database: string;
	password: string;
	user: string;
}

export async function startPostgresHarness(): Promise<StartedPostgresHarness> {
	const user = 'optigrid_test_user';
	const password = 'optigrid_test_password';
	const database = `optigrid_int_${randomUUID().replace(/-/g, '')}`;

	const container = await new GenericContainer('postgres:16-alpine')
		.withEnvironment({
			POSTGRES_USER: user,
			POSTGRES_PASSWORD: password,
			POSTGRES_DB: database,
		})
		.withExposedPorts(5432)
		.withWaitStrategy(
			Wait.forAll([Wait.forListeningPorts(), Wait.forLogMessage('database system is ready to accept connections', 2)])
		)
		.withStartupTimeout(120_000)
		.start();

	const host = container.getHost();
	const port = container.getMappedPort(5432);
	const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;

	return {
		connectionString,
		container,
		database,
		password,
		user,
	};
}

export async function stopPostgresHarness(harness: StartedPostgresHarness): Promise<void> {
	await harness.container.stop();
}
