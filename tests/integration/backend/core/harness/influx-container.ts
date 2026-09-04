import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

export interface StartedInfluxHarness {
	url: string;
	token: string;
	org: string;
	bucket: string;
	container: StartedTestContainer;
}

export async function startInfluxHarness(): Promise<StartedInfluxHarness> {
	const token = 'test-token-1234567890';
	const org = 'OptiGridTest';
	const bucket = 'EnergyDataTest';

	const container = await new GenericContainer('influxdb:2.7-alpine')
		.withEnvironment({
			DOCKER_INFLUXDB_INIT_MODE: 'setup',
			DOCKER_INFLUXDB_INIT_USERNAME: 'admin',
			DOCKER_INFLUXDB_INIT_PASSWORD: 'password123',
			DOCKER_INFLUXDB_INIT_ORG: org,
			DOCKER_INFLUXDB_INIT_BUCKET: bucket,
			DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: token,
		})
		.withExposedPorts(8086)
		.withWaitStrategy(Wait.forHttp('/', 8086).forStatusCode(200))
		.withStartupTimeout(120_000)
		.start();

	const host = container.getHost();
	const port = container.getMappedPort(8086);
	const url = `http://${host}:${port}`;

	return {
		url,
		token,
		org,
		bucket,
		container,
	};
}

export async function stopInfluxHarness(harness: StartedInfluxHarness): Promise<void> {
	await harness.container.stop();
}
