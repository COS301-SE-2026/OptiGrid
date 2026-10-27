import { act, renderHook } from "@testing-library/react";
import { formatPreferencesActive, reloadDisplayPreferences, setDisplayPreferences } from "./displayPreferences";
import { useDisplayPreferences, useFormatPreferences, useLiveInterval, useReducedMotion } from "./useDisplayPreferences";

function deviceWantsLessMotion(reduce: boolean) {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: reduce,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
    localStorage.clear();
    reloadDisplayPreferences();
});

describe("useReducedMotion", () => {
    it("follows the device when the Motion choice is Match device", () => {
        deviceWantsLessMotion(true);
        const { result } = renderHook(() => useReducedMotion());
        expect(result.current).toBe(true);
    });

    it("reduces motion when asked, whatever the device says", () => {
        deviceWantsLessMotion(false);
        const { result } = renderHook(() => useReducedMotion());
        expect(result.current).toBe(false);

        act(() => {
            setDisplayPreferences({ motion: "reduce" });
        });
        expect(result.current).toBe(true);
    });

    it("keeps full motion even when the device asks for less", () => {
        deviceWantsLessMotion(true);
        setDisplayPreferences({ motion: "full" });
        const { result } = renderHook(() => useReducedMotion());
        expect(result.current).toBe(false);
    });
});

describe("useLiveInterval", () => {
    it("changes with the Live updates choice", () => {
        const { result } = renderHook(() => useLiveInterval(5000));
        expect(result.current).toBe(5000);

        act(() => {
            setDisplayPreferences({ liveUpdates: "saver" });
        });
        expect(result.current).toBe(20000);

        act(() => {
            setDisplayPreferences({ liveUpdates: "paused" });
        });
        expect(result.current).toBe(false);
    });
});

describe("useDisplayPreferences", () => {
    it("picks up the choices saved before the page loaded", () => {
        localStorage.setItem("optigrid-display-preferences", JSON.stringify({ region: "za" }));
        const { result } = renderHook(() => useDisplayPreferences());
        expect(result.current.region).toBe("default");

        act(() => {
            reloadDisplayPreferences();
        });
        expect(result.current.region).toBe("za");
    });
});

describe("useFormatPreferences", () => {
    it("turns the saved formats on once mounted and follows later changes", () => {
        setDisplayPreferences({ region: "us" });
        const { result } = renderHook(() => useFormatPreferences());

        expect(formatPreferencesActive()).toBe(true);
        expect(result.current).toEqual({ region: "us", clock: "default" });

        act(() => {
            setDisplayPreferences({ clock: "12h" });
        });
        expect(result.current).toEqual({ region: "us", clock: "12h" });
    });
});