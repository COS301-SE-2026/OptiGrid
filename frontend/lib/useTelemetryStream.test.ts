import { renderHook, act } from "@testing-library/react";
import { useTelemetryStream } from "./useTelemetryStream";
import { TAB_SESSION_STORAGE_KEY } from "./tab-session";

const TAB_ID = "6f1c2b3a-4d5e-4f60-8a71-92b3c4d5e6f7";

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
        window.sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, TAB_ID);
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
        expect(MockEventSource.instances[0].url).toBe(`/_sessions/${TAB_ID}/api/telemetry/stream/portfolio`);
    });

    it("updates the connection state on EventSource open", () => {
        const { result } = renderHook(() => useTelemetryStream("bld-123"));
        const mockEs = MockEventSource.instances[0];

        act(() => {
            mockEs.emitOpen();
        });

        expect(result.current.isConnected).toBe(true);
        expect(result.current.error).toBeNull();
    });


    it("waits for a building id before opening a building stream", () => {
        const { result } = renderHook(() => useTelemetryStream(""));

        expect(MockEventSource.instances).toHaveLength(0);
        expect(result.current.isConnected).toBe(false);
        expect(result.current.liveData).toBeNull();
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
        expect(MockEventSource.instances[1].url).toBe(`/_sessions/${TAB_ID}/api/telemetry/stream/bld-456`);
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


    const reading = (sensorId: string) => ({
        building_id: "bld-123",
        sensor_id: sensorId,
        power_kw: 4.2,
        timestamp: "2026-09-17T10:00:00.000Z",
    });

    it("shares one connection between subscribers of a building", () => {
        const first = renderHook(() => useTelemetryStream("bld-123"));
        const second = renderHook(() => useTelemetryStream("bld-123"));
        const shared = MockEventSource.instances[0];

        expect(MockEventSource.instances).toHaveLength(1);

        act(() => {
            shared.emitOpen();
            shared.emitMessage(reading("sens-1"));
        });
        expect(first.result.current.isConnected).toBe(true);
        expect(first.result.current.liveData?.sensor_id).toBe("sens-1");
        expect(second.result.current.liveData?.sensor_id).toBe("sens-1");

        first.unmount();
        expect(shared.closed).toBe(false);

        second.unmount();
        expect(shared.closed).toBe(true);
    });

    it("tells a late subscriber that the shared stream is already open", () => {
        renderHook(() => useTelemetryStream("bld-123"));
        act(() => {
            MockEventSource.instances[0].emitOpen();
        });

        const late = renderHook(() => useTelemetryStream("bld-123"));

        expect(MockEventSource.instances).toHaveLength(1);
        expect(late.result.current.isConnected).toBe(true);
    });

    it("closes the EventSource connection when the component unmounts", () => {
        const { unmount } = renderHook(() => useTelemetryStream("bld-123"));
        const mockEs = MockEventSource.instances[0];

        unmount();

        expect(mockEs.closed).toBe(true);
    });

    it("gives every reading to the callback including batched payloads", () => {
        const onReading = jest.fn();
        const { result } = renderHook(() => useTelemetryStream("bld-123", { onReading, trackLatest: false }));
        const stream = MockEventSource.instances[0];

        act(() => {
            stream.emitMessage([reading("sens-1"), reading("sens-2")]);
            stream.emitMessage(reading("sens-3"));
        });

        expect(onReading.mock.calls.map(([payload]) => payload.sensor_id)).toEqual(["sens-1", "sens-2", "sens-3"]);
        expect(result.current.liveData).toBeNull();
    });

    it("switches to a new callback without reopening the stream", () => {
        const firstCallback = jest.fn();
        const secondCallback = jest.fn();
        const { rerender } = renderHook(
            ({ onReading }) => useTelemetryStream("bld-123", { onReading }),
            { initialProps: { onReading: firstCallback } },
        );

        rerender({ onReading: secondCallback });
        act(() => {
            MockEventSource.instances[0].emitMessage(reading("sens-1"));
        });

        expect(MockEventSource.instances).toHaveLength(1);
        expect(firstCallback).not.toHaveBeenCalled();
        expect(secondCallback).toHaveBeenCalledWith(reading("sens-1"));
    });

    it("skips any non-telemetry payloads", () => {
        const onReading = jest.fn();
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        renderHook(() => useTelemetryStream("bld-123", { onReading }));
        const stream = MockEventSource.instances[0];

        act(() => {
            stream.onmessage?.(new MessageEvent("message", { data: "{not json" }));
            stream.emitMessage([null, 7, "text"]);
        });

        expect(onReading).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith("Failed to parse telemetry event data:", expect.any(SyntaxError));
        errorSpy.mockRestore();
    });

    it("reconnects with a growing delay and resets it once connected", () => {
        jest.useFakeTimers();
        try {
            const { result, unmount } = renderHook(() => useTelemetryStream("bld-123"));

            act(() => {
                MockEventSource.instances[0].emitError();
            });
            expect(MockEventSource.instances).toHaveLength(1);

            act(() => {
                jest.advanceTimersByTime(2000);
            });
            expect(MockEventSource.instances).toHaveLength(2);
            expect(result.current.error?.message).toBe("Lost connection to telemetry stream.");

            act(() => {
                MockEventSource.instances[1].emitError();
                jest.advanceTimersByTime(3999);
            });
            expect(MockEventSource.instances).toHaveLength(2);

            act(() => {
                jest.advanceTimersByTime(1);
            });
            expect(MockEventSource.instances).toHaveLength(3);

            act(() => {
                MockEventSource.instances[2].emitOpen();
            });
            expect(result.current.isConnected).toBe(true);
            expect(result.current.error).toBeNull();

            act(() => {
                MockEventSource.instances[2].emitError();
                jest.advanceTimersByTime(2000);
            });
            expect(MockEventSource.instances).toHaveLength(4);

            unmount();
            expect(MockEventSource.instances[3].closed).toBe(true);
        } finally {
            jest.useRealTimers();
        }
    });

    it("stops retrying as soon as nobody is listening", () => {
        jest.useFakeTimers();
        try {
            const { unmount } = renderHook(() => useTelemetryStream("bld-123"));

            act(() => {
                MockEventSource.instances[0].emitError();
            });
            unmount();
            act(() => {
                jest.advanceTimersByTime(60000);
            });

            expect(MockEventSource.instances).toHaveLength(1);
        } finally {
            jest.useRealTimers();
        }
    });
});