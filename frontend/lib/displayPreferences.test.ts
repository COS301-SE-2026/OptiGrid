import {
    activateFormatPreferences,
    DATA_SAVER_FACTOR,
    DEFAULT_DISPLAY_PREFERENCES,
    DISPLAY_PREFERENCES_KEY,
    displayPreferencesInitializationScript,
    getDisplayPreferences,
    getFormatPreferences,
    liveInterval,
    preferredScrollBehavior,
    parseDisplayPreferences,
    reloadDisplayPreferences,
    setDisplayPreferences,
    subscribeDisplayPreferences,
} from "./displayPreferences";

function saved() {
    return JSON.parse(localStorage.getItem(DISPLAY_PREFERENCES_KEY) ?? "null");
}

beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.motion;
    reloadDisplayPreferences();
});

describe("parseDisplayPreferences", () => {
    it("falls back to the defaults for missing or broken data", () => {
        expect(parseDisplayPreferences(null)).toEqual(DEFAULT_DISPLAY_PREFERENCES);
        expect(parseDisplayPreferences("{not json")).toEqual(DEFAULT_DISPLAY_PREFERENCES);
        expect(parseDisplayPreferences("[1,2]")).toEqual(DEFAULT_DISPLAY_PREFERENCES);
    });

    it("keeps valid choices and drops unknown ones", () => {
        const parsed = parseDisplayPreferences(JSON.stringify({ motion: "reduce", graphics: "ultra", region: "za", extra: true }));

        expect(parsed).toEqual({ ...DEFAULT_DISPLAY_PREFERENCES, motion: "reduce", region: "za" });
    });
});

describe("display preference store", () => {
    it("stays on the defaults until the saved choices are loaded", () => {
        localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify({ liveUpdates: "paused" }));

        expect(getDisplayPreferences().liveUpdates).toBe("normal");
        expect(reloadDisplayPreferences().liveUpdates).toBe("paused");
        expect(getDisplayPreferences().liveUpdates).toBe("paused");
    });

    it("saves a change, applies motion to the page and tells subscribers", () => {
        const listener = jest.fn();
        const unsubscribe = subscribeDisplayPreferences(listener);

        setDisplayPreferences({ motion: "reduce", clock: "24h" });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(saved()).toMatchObject({ motion: "reduce", clock: "24h" });
        expect(document.documentElement.dataset.motion).toBe("reduce");

        setDisplayPreferences({ motion: "system" });
        expect(document.documentElement.dataset.motion).toBeUndefined();
        unsubscribe();
    });

    it("keeps other saved choices when one changes before the first load", async () => {
        localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify({ region: "gb" }));
        await jest.isolateModulesAsync(async () => {
            const fresh = await import("./displayPreferences");
            fresh.setDisplayPreferences({ clock: "12h" });
        });

        expect(saved()).toMatchObject({ region: "gb", clock: "12h" });
    });

    it("follows a change made in another tab", () => {
        const listener = jest.fn();
        const unsubscribe = subscribeDisplayPreferences(listener);
        localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify({ graphics: "saver" }));

        window.dispatchEvent(new StorageEvent("storage", { key: DISPLAY_PREFERENCES_KEY }));

        expect(listener).toHaveBeenCalled();
        expect(getDisplayPreferences().graphics).toBe("saver");
        unsubscribe();
    });

    it("ignores storage events for other keys", () => {
        const listener = jest.fn();
        const unsubscribe = subscribeDisplayPreferences(listener);

        window.dispatchEvent(new StorageEvent("storage", { key: "optigrid-theme" }));

        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });

    it("keeps working when storage is blocked", () => {
        const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });

        expect(setDisplayPreferences({ graphics: "high" }).graphics).toBe("high");
        expect(getDisplayPreferences().graphics).toBe("high");
        setItem.mockRestore();
    });
});

describe("format preferences", () => {
    it("hold the server formats until a page turns them on", async () => {
        localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify({ region: "za", clock: "24h" }));
        await jest.isolateModulesAsync(async () => {
            const fresh = await import("./displayPreferences");
            const listener = jest.fn();
            const unsubscribe = fresh.subscribeDisplayPreferences(listener);
            fresh.reloadDisplayPreferences();

            expect(fresh.getDisplayPreferences().region).toBe("za");
            expect(fresh.getFormatPreferences()).toBe(fresh.getServerFormatPreferences());
            expect(fresh.formatPreferencesActive()).toBe(false);

            listener.mockClear();
            fresh.activateFormatPreferences();
            fresh.activateFormatPreferences();

            expect(fresh.getFormatPreferences()).toEqual({ region: "za", clock: "24h" });
            expect(fresh.formatPreferencesActive()).toBe(true);
            expect(listener).toHaveBeenCalledTimes(1);
            unsubscribe();
        });
    });

    it("load the saved choices first when nothing has loaded them yet", async () => {
        localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify({ clock: "12h" }));
        await jest.isolateModulesAsync(async () => {
            const fresh = await import("./displayPreferences");
            fresh.activateFormatPreferences();

            expect(fresh.getFormatPreferences().clock).toBe("12h");
        });
    });

    it("follow later changes and keep the same object while nothing changes", () => {
        activateFormatPreferences();
        const before = getFormatPreferences();

        setDisplayPreferences({ graphics: "high" });
        expect(getFormatPreferences()).toBe(before);

        setDisplayPreferences({ region: "gb" });
        expect(getFormatPreferences()).toEqual({ region: "gb", clock: "default" });
    });
});

describe("liveInterval", () => {
    it("turns a page's base refresh interval into the one for each mode", () => {
        expect(liveInterval(5000, "normal")).toBe(5000);
        expect(liveInterval(5000, "saver")).toBe(5000 * DATA_SAVER_FACTOR);
        expect(liveInterval(5000, "paused")).toBe(false);
    });
});

describe("displayPreferencesInitializationScript", () => {
    const run = () => new Function(displayPreferencesInitializationScript)();

    it("applies a saved motion choice before React starts", () => {
        localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify({ motion: "full" }));
        run();
        expect(document.documentElement.dataset.motion).toBe("full");
    });

    it("leaves the device in charge for other values", () => {
        localStorage.setItem(DISPLAY_PREFERENCES_KEY, "{broken");
        run();
        localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify({ motion: "system" }));
        run();
        expect(document.documentElement.dataset.motion).toBeUndefined();
    });
});

describe("preferredScrollBehavior", () => {
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    function deviceReducesMotion(reduce: boolean) {
        window.matchMedia = jest.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia;
    }

    it("follows the Motion choice before the device", () => {
        deviceReducesMotion(false);
        setDisplayPreferences({ motion: "reduce" });
        expect(preferredScrollBehavior()).toBe("auto");

        deviceReducesMotion(true);
        setDisplayPreferences({ motion: "full" });
        expect(preferredScrollBehavior()).toBe("smooth");
    });
    
    it("scrolls smoothly when the browser cannot report a preference", () => {
        window.matchMedia = undefined as unknown as typeof window.matchMedia;
        expect(preferredScrollBehavior()).toBe("smooth");
    });

    
    it("asks the device when the choice is Match device", () => {
        deviceReducesMotion(true);
        expect(preferredScrollBehavior()).toBe("auto");

        deviceReducesMotion(false);
        expect(preferredScrollBehavior()).toBe("smooth");
    });

});