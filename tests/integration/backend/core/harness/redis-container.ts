import { GenericContainer, StartedTestContainer } from 'testcontainers';

export interface StartedRedisHarness {
    container: StartedTestContainer;
    host: string;
    port: number;
    url: string;
}

export async function startRedisHarness(): Promise<StartedRedisHarness> {
    const container = await new GenericContainer('redis:7-alpine@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2')
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
