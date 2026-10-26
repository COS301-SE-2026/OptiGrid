export type MotionPreference = "system" | "reduce" | "full";
export type GraphicsQuality = "auto" | "saver" | "high";
export type LiveUpdateMode = "normal" | "saver" | "paused";
export type RegionFormat = "default" | "za" | "gb" | "us";
export type ClockFormat = "default" | "24h" | "12h";

export type DisplayPreferences = {
    motion: MotionPreference;
    graphics: GraphicsQuality;
    liveUpdates: LiveUpdateMode;
    region: RegionFormat;
    clock: ClockFormat;
};

export type FormatPreferences = Pick<DisplayPreferences, "region" | "clock">;

export const DISPLAY_PREFERENCES_KEY = "optigrid-display-preferences";

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = Object.freeze({
    motion: "system",
    graphics: "auto",
    liveUpdates: "normal",
    region: "default",
    clock: "default",
});

const ALLOWED_VALUES: { readonly [K in keyof DisplayPreferences]: readonly DisplayPreferences[K][] } = {
    motion: ["system", "reduce", "full"],
    graphics: ["auto", "saver", "high"],
    liveUpdates: ["normal", "saver", "paused"],
    region: ["default", "za", "gb", "us"],
    clock: ["default", "24h", "12h"],
};

// How often each live view asks for new data when updates run normally.
export const LIVE_REFRESH_MS = {
    liveReadings: 5_000,
    buildingList: 60_000,
    dashboard: 60_000,
    heatmap: 30_000,
    twinSnapshot: 15_000,
} as const;

export const DATA_SAVER_FACTOR = 4;

export function liveInterval(baseMs: number, mode: LiveUpdateMode): number | false {
    if (mode === "paused") {
        return false;
    }
    return mode === "saver" ? baseMs * DATA_SAVER_FACTOR : baseMs;
}

function isAllowed<K extends keyof DisplayPreferences>(key: K, value: unknown): value is DisplayPreferences[K] {
    return (ALLOWED_VALUES[key] as readonly unknown[]).includes(value);
}

export function parseDisplayPreferences(raw: string | null): DisplayPreferences {
    let stored: unknown = null;
    try {
        stored = raw ? JSON.parse(raw) : null;
    } catch {
        stored = null;
    }

    const saved = stored && typeof stored === "object" && !Array.isArray(stored) ? stored as Record<string, unknown> : {};
    return {
        motion: isAllowed("motion", saved.motion) ? saved.motion : DEFAULT_DISPLAY_PREFERENCES.motion,
        graphics: isAllowed("graphics", saved.graphics) ? saved.graphics : DEFAULT_DISPLAY_PREFERENCES.graphics,
        liveUpdates: isAllowed("liveUpdates", saved.liveUpdates) ? saved.liveUpdates : DEFAULT_DISPLAY_PREFERENCES.liveUpdates,
        region: isAllowed("region", saved.region) ? saved.region : DEFAULT_DISPLAY_PREFERENCES.region,
        clock: isAllowed("clock", saved.clock) ? saved.clock : DEFAULT_DISPLAY_PREFERENCES.clock,
    };
}

let current: DisplayPreferences = DEFAULT_DISPLAY_PREFERENCES;
let loaded = false;
const listeners = new Set<() => void>();

const SERVER_FORMATS: FormatPreferences = Object.freeze({
    region: DEFAULT_DISPLAY_PREFERENCES.region,
    clock: DEFAULT_DISPLAY_PREFERENCES.clock,
});
let formats: FormatPreferences = SERVER_FORMATS;
let formatsActive = false;

function syncFormats() {
    if (formatsActive && (formats.region !== current.region || formats.clock !== current.clock)) {
        formats = { region: current.region, clock: current.clock };
    }
}

function readStoredPreferences(): string | null {
    try {
        return window.localStorage.getItem(DISPLAY_PREFERENCES_KEY);
    } catch {
        return null;
    }
}

function notify() {
    listeners.forEach((listener) => listener());
}

export function applyDisplayPreferences(preferences: DisplayPreferences, root: HTMLElement = document.documentElement): void {
    if (preferences.motion === "system") {
        delete root.dataset.motion;
    } else {
        root.dataset.motion = preferences.motion;
    }
}

// stay on the defaults until reloadDisplayPreferences runs after the first render
export function getDisplayPreferences(): DisplayPreferences {
    return current;
}

export function getServerDisplayPreferences(): DisplayPreferences {
    return DEFAULT_DISPLAY_PREFERENCES;
}

//Dashboard pages hydrate inside their own Suspense boundary after the providers have loaded the saved choices
export function getFormatPreferences(): FormatPreferences {
    return formats;
}

export function getServerFormatPreferences(): FormatPreferences {
    return SERVER_FORMATS;
}

export function formatPreferencesActive(): boolean {
    return formatsActive;
}

export function activateFormatPreferences(): void {
    if (formatsActive) {
        return;
    }
    if (!loaded && typeof window !== "undefined") {
        reloadDisplayPreferences();
    }
    formatsActive = true;
    // A new object even for unchanged choice because the browser locale may differ from the server one
    formats = { region: current.region, clock: current.clock };
    notify();
}

// read the saved choices again, for example after another tab changed them.
export function reloadDisplayPreferences(): DisplayPreferences {
    current = typeof window === "undefined" ? DEFAULT_DISPLAY_PREFERENCES : parseDisplayPreferences(readStoredPreferences());
    loaded = typeof window !== "undefined";
    if (loaded) {
        applyDisplayPreferences(current);
    }
    syncFormats();
    notify();
    return current;
}

export function setDisplayPreferences(changes: Partial<DisplayPreferences>): DisplayPreferences {
    const saved = loaded || typeof window === "undefined" ? current : parseDisplayPreferences(readStoredPreferences());
    const next = parseDisplayPreferences(JSON.stringify({ ...saved, ...changes }));
    current = next;
    loaded = true;
    try {
        window.localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify(next));
    } catch {
        // Blocked storage only means the choice lasts until the tab closes.
    }
    applyDisplayPreferences(next);
    syncFormats();
    notify();
    return next;
}

function handleStorage(event: StorageEvent) {
    if (event.key === null || event.key === DISPLAY_PREFERENCES_KEY) {
        reloadDisplayPreferences();
    }
}

export function subscribeDisplayPreferences(listener: () => void): () => void {
    listeners.add(listener);
    if (listeners.size === 1 && typeof window !== "undefined") {
        window.addEventListener("storage", handleStorage);
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== "undefined") {
            window.removeEventListener("storage", handleStorage);
        }
    };
}

export function preferredScrollBehavior(): ScrollBehavior {
    if (typeof window === "undefined") {
        return "auto";
    }
    const motion = document.documentElement.dataset.motion;
    if (motion === "reduce" || motion === "full") {
        return motion === "reduce" ? "auto" : "smooth";
    }
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
}

// this runs in the page head before React starts
export const displayPreferencesInitializationScript = `(() => {
  try {
    const saved = JSON.parse(window.localStorage.getItem("${DISPLAY_PREFERENCES_KEY}") || "{}");
    if (saved && (saved.motion === "reduce" || saved.motion === "full")) {
      document.documentElement.setAttribute("data-motion", saved.motion);
    }
  } catch {
    // Without readable storage the device setting decides.
  }
})();`;