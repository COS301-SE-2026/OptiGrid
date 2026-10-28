import { renderHook, act } from "@testing-library/react";
import { useAnomalyAlerts } from "./useAnomalyAlerts";
import { TAB_SESSION_STORAGE_KEY } from "./tab-session";
import { DISPLAY_PREFERENCES_KEY, reloadDisplayPreferences, setDisplayPreferences } from "./displayPreferences";

const TAB_ID = "6f1c2b3a-4d5e-4f60-8a71-92b3c4d5e6f7";

class MockEventSource {
    static instances: MockEventSource[] = [];
    url: string;
    withCredentials: boolean;
    onopen: (() => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    closed = false;

    constructor(url: string, init?: EventSourceInit) {
        this.url = url;
        this.withCredentials = Boolean(init?.withCredentials);
        MockEventSource.instances.push(this);
    }

    close() {
        this.closed = true;
    }

    emitRaw(data: string) {
        this.onmessage?.(new MessageEvent("message", { data }));
    }

    emitMessage(data: unknown) {
        this.emitRaw(JSON.stringify(data));
    }

    emitError() {
        this.onerror?.(new Event("error"));
    }
}

const anomaly = {
    anomaly_id: "anomaly-1",
    building_id: "building-1",
    building_name: "Sandton Mall",
    severity_level: "critical",
    status: "Open",
};

describe("useAnomalyAlerts", () => {
    let originalEventSource: typeof global.EventSource;

    beforeEach(() => {
        jest.useFakeTimers();
        MockEventSource.instances = [];
        window.sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, TAB_ID);
        window.localStorage.removeItem(DISPLAY_PREFERENCES_KEY);
        reloadDisplayPreferences();
        originalEventSource = global.EventSource;
        global.EventSource = MockEventSource as unknown as typeof EventSource;
    });

    afterEach(() => {
        global.EventSource = originalEventSource;
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it("listens on the same origin through the tab session path instead of a listening through WebSocket", () => {
        const { unmount } = renderHook(() => useAnomalyAlerts());

        expect(MockEventSource.instances).toHaveLength(1);
        expect(MockEventSource.instances[0].url).toBe(`/_sessions/${TAB_ID}/api/anomalies/stream`);
        expect(MockEventSource.instances[0].withCredentials).toBe(true);

        unmount();
        expect(MockEventSource.instances[0].closed).toBe(true);
    });

    it("shows a toast for a new anomaly and hides it after five seconds", () => {
        const { result } = renderHook(() => useAnomalyAlerts());

        act(() => {
            MockEventSource.instances[0].emitMessage({ event: "ANOMALY_DETECTED", payload: anomaly });
        });

        expect(result.current.latestAnomaly).toEqual(anomaly);
        expect(result.current.toastMessage).toBe("New critical anomaly detected for building Sandton Mall!");

        act(() => {
            jest.advanceTimersByTime(5000);
        });
        expect(result.current.toastMessage).toBeNull();
    });

    it("ignores other events and messages which it cannot read", () => {
        jest.spyOn(console, "error").mockImplementation(() => undefined);
        const { result } = renderHook(() => useAnomalyAlerts());

        act(() => {
            MockEventSource.instances[0].emitMessage({ event: "FORECAST_READY", payload: {} });
            MockEventSource.instances[0].emitRaw("not json");
        });

        expect(result.current.latestAnomaly).toBeNull();
        expect(result.current.toastMessage).toBeNull();
        expect(console.error).toHaveBeenCalled();
    });

    it("reconnects with a growing delay after the stream drops", () => {
        const { unmount } = renderHook(() => useAnomalyAlerts());

        act(() => {
            MockEventSource.instances[0].emitError();
        });
        expect(MockEventSource.instances[0].closed).toBe(true);

        act(() => {
            jest.advanceTimersByTime(1999);
        });
        expect(MockEventSource.instances).toHaveLength(1);
        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(MockEventSource.instances).toHaveLength(2);

        act(() => {
            MockEventSource.instances[1].emitError();
            jest.advanceTimersByTime(3999);
        });
        expect(MockEventSource.instances).toHaveLength(2);
        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(MockEventSource.instances).toHaveLength(3);

        unmount();
        act(() => {
            MockEventSource.instances[2].emitError();
            jest.advanceTimersByTime(60000);
        });
        expect(MockEventSource.instances).toHaveLength(3);
    });

    it("stays quiet while live updates are paused but keeps alerts on data saver mode", () => {
        setDisplayPreferences({ liveUpdates: "paused" });
        const paused = renderHook(() => useAnomalyAlerts());
        expect(MockEventSource.instances).toHaveLength(0);
        paused.unmount();

        setDisplayPreferences({ liveUpdates: "saver" });
        const saver = renderHook(() => useAnomalyAlerts());
        expect(MockEventSource.instances).toHaveLength(1);
        saver.unmount();
    });
});