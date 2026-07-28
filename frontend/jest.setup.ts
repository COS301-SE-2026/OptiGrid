import "@testing-library/jest-dom";

if (typeof global.EventSource === "undefined") {
    class MockEventSource {
        url: string;
        onopen: (() => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        readyState = 0;
        constructor(url: string) {
            this.url = url;
        }
        close() {
            // leave comment hear so sonar qube does not flag
        }
    }
    global.EventSource = MockEventSource as unknown as typeof EventSource;
}