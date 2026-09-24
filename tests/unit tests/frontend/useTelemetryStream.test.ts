import { renderHook, act } from "@testing-library/react";
import { useTelemetryStream } from "@/lib/useTelemetryStream";

class MockEventSource {
    static instances: MockEventSource[] = [];
    url: string;
    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    closed = false;

    constructor(url: string) {
        this.url = url;
        MockEventSource.instances.push(this);
    }

    close() {
        this.closed = true;
    }

    emitOpen() {
        if (this.onopen) this.onopen();
    }

    emitMessage(data: unknown) {
        if (this.onmessage) {
            this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }));
        }
    }

    emitError() {
        if (this.onerror) {
            this.onerror(new Event("error"));
        }
    }
}

describe("useTelemetryStream", () => {
    let originalEventSource: typeof global.EventSource;

    beforeEach(() => {
        MockEventSource.instances = [];
        originalEventSource = global.EventSource;
        global.EventSource = MockEventSource as unknown as typeof EventSource;
    });

    afterEach(() => {
        global.EventSource = originalEventSource;
        jest.clearAllMocks();
    });

    it("initializes with disconnected state and null data", () => {
        const { result } = renderHook(() => useTelemetryStream("bld-123"));

        expect(result.current.isConnected).toBe(false);
        expect(result.current.liveData).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it("uses the portfolio stream when no building id is provided", () => {
        renderHook(() => useTelemetryStream());

        expect(MockEventSource.instances).toHaveLength(1);
        expect(MockEventSource.instances[0].url).toBe("/api/telemetry/stream/portfolio");
    });

    it("waits for a building id before opening a building stream", () => {
        const { result } = renderHook(() => useTelemetryStream(""));

        expect(MockEventSource.instances).toHaveLength(0);
        expect(result.current.isConnected).toBe(false);
        expect(result.current.liveData).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it("updates connection state on EventSource open", () => {
        const { result } = renderHook(() => useTelemetryStream("bld-123"));
        const mockEs = MockEventSource.instances[0];

        act(() => {
            mockEs.emitOpen();
        });

        expect(result.current.isConnected).toBe(true);
        expect(result.current.error).toBeNull();
    });

    it("parses incoming telemetry payloads and updates liveData state", () => {
        const { result } = renderHook(() => useTelemetryStream("bld-123"));
        const mockEs = MockEventSource.instances[0];

        const mockPayload = {
            building_id: "bld-123",
            sensor_id: "sens-456",
            source_type: "GRID",
            voltage_v: 230.5,
            current_a: 12.4,
            power_kw: 45.2,
            timestamp: "2026-07-28T10:00:00.000Z",
        };

        act(() => {
            mockEs.emitMessage(mockPayload);
        });

        expect(result.current.liveData).toEqual(mockPayload);
    });

    it("resets stale data when the stream target changes", () => {
        const { result, rerender } = renderHook(
            ({ buildingId }) => useTelemetryStream(buildingId),
            { initialProps: { buildingId: "bld-123" } },
        );
        const firstStream = MockEventSource.instances[0];

        act(() => {
            firstStream.emitMessage({
                building_id: "bld-123",
                sensor_id: "sens-123",
                power_kw: 45.2,
                timestamp: "2026-07-28T10:00:00.000Z",
            });
        });
        expect(result.current.liveData?.building_id).toBe("bld-123");

        rerender({ buildingId: "bld-456" });

        expect(firstStream.closed).toBe(true);
        expect(MockEventSource.instances).toHaveLength(2);
        expect(MockEventSource.instances[1].url).toBe("/api/telemetry/stream/bld-456");
        expect(result.current.liveData).toBeNull();
        expect(result.current.isConnected).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it("handles connection errors and disconnects the stream", () => {
        const { result } = renderHook(() => useTelemetryStream("bld-123"));
        const mockEs = MockEventSource.instances[0];

        act(() => {
            mockEs.emitOpen();
        });
        expect(result.current.isConnected).toBe(true);

        act(() => {
            mockEs.emitError();
        });

        expect(result.current.isConnected).toBe(false);
        expect(result.current.error?.message).toBe("Lost connection to telemetry stream.");
        expect(mockEs.closed).toBe(true);
    });

    it("closes the EventSource connection when the component unmounts", () => {
        const { unmount } = renderHook(() => useTelemetryStream("bld-123"));
        const mockEs = MockEventSource.instances[0];

        unmount();

        expect(mockEs.closed).toBe(true);
    });
});
