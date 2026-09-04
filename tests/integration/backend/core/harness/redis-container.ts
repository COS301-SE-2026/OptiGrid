import { GenericContainer, StartedTestContainer } from 'testcontainers';

export interface StartedRedisHarness {
    container: StartedTestContainer;
    host: string;
    port: number;
    url: string;
}

export async function startRedisHarness(): Promise<StartedRedisHarness> {
    const container = await new GenericContainer('redis:7-alpine')
        .withExposedPorts(6379)
        .start();

    const host = container.getHost();
    const port = container.getMappedPort(6379);

    return {
        container,
        host,
        port,
        url: `redis://${host}:${port}`
    };
}

export async function stopRedisHarness(harness: StartedRedisHarness): Promise<void> {
    await harness.container.stop();
}
