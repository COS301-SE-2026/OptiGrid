import { activateFormatPreferences, DISPLAY_PREFERENCES_KEY, reloadDisplayPreferences, setDisplayPreferences } from "./displayPreferences";
import { applyClock, formatDate, formatDateTime, formatNumber, formatTime } from "./format";

const MOMENT = new Date(2026, 9, 25, 14, 5, 9);

beforeEach(() => {
    localStorage.clear();
    reloadDisplayPreferences();
    activateFormatPreferences();
});

describe("format before the page has hydrated", () => {
    it("prints what the server printed and switches over once the page is ready", async () => {
        localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify({ region: "za" }));
        await jest.isolateModulesAsync(async () => {
            const store = await import("./displayPreferences");
            const fresh = await import("./format");
            const numberFormat = jest.spyOn(Intl, "NumberFormat");
            store.reloadDisplayPreferences();

            expect(fresh.formatNumber(1234.5, { minimumFractionDigits: 1 })).toBe("1,234.5");
            expect(numberFormat).toHaveBeenLastCalledWith("en-US", { minimumFractionDigits: 1 });

            store.activateFormatPreferences();
            expect(fresh.formatNumber(1234.5, { minimumFractionDigits: 1 })).toBe(
                new Intl.NumberFormat("en-ZA", { minimumFractionDigits: 1 }).format(1234.5),
            );
            numberFormat.mockRestore();
        });
    });
});

describe("format with the Default region", () => {
    it("matches the browser formatting each screen used before", () => {
        expect(formatNumber(1234567.891)).toBe((1234567.891).toLocaleString());
        expect(formatNumber(12.5, { minimumFractionDigits: 2 })).toBe((12.5).toLocaleString(undefined, { minimumFractionDigits: 2 }));
        expect(formatTime(MOMENT)).toBe(MOMENT.toLocaleTimeString());
    });

    it("keeps a screen's own fallback locale", () => {
        const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false };

        expect(formatDateTime(MOMENT, options, "en")).toBe(new Intl.DateTimeFormat("en", options).format(MOMENT));
    });
});

describe("format with a chosen region", () => {
    it.each([
        ["za", "en-ZA"],
        ["gb", "en-GB"],
        ["us", "en-US"],
    ] as const)("uses %s formatting everywhere", (region, locale) => {
        setDisplayPreferences({ region });
        const dateOptions: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric" };

        expect(formatNumber(1234567.89, { maximumFractionDigits: 2 }, "en")).toBe(
            new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(1234567.89),
        );
        expect(formatDate(MOMENT, dateOptions, "en")).toBe(new Intl.DateTimeFormat(locale, dateOptions).format(MOMENT));
    });

    it("writes South African numbers with spaced thousands and a decimal comma", () => {
        setDisplayPreferences({ region: "za" });

        expect(formatNumber(1234.5, { minimumFractionDigits: 2 }).replace(/\s/g, " ")).toBe("1 234,50");
        expect(formatDate(MOMENT, { day: "numeric", month: "numeric", year: "numeric" })).toBe("2026/10/25");
    });
});

describe("clock choice", () => {
    it("leaves date-only formats alone", () => {
        expect(applyClock({ day: "numeric" }, "24h")).toEqual({ day: "numeric" });
    });

    it("shows times on the chosen clock", () => {
        const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };

        setDisplayPreferences({ clock: "12h" });
        expect(formatTime(MOMENT, options, "en")).toBe("02:05 PM");

        setDisplayPreferences({ clock: "24h" });
        expect(formatTime(MOMENT, { hour: "numeric", minute: "2-digit" }, "en")).toBe("14:05");
    });

    it("overrides the 12 or 24 hour setting a screen asked for", () => {
        expect(applyClock({ hour: "2-digit", hour12: false }, "12h")).toEqual({ hour: "2-digit", hourCycle: "h12" });
        expect(applyClock({ timeStyle: "short" }, "24h")).toEqual({ timeStyle: "short", hourCycle: "h23" });
        expect(applyClock({ hour: "numeric", hour12: true }, "default")).toEqual({ hour: "numeric", hour12: true });
    });
});

describe("format input handling", () => {
    it("accepts strings and timestamps", () => {
        const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

        expect(formatDate(MOMENT.toISOString(), options, "en")).toBe(formatDate(MOMENT, options, "en"));
        expect(formatDate(MOMENT.getTime(), options, "en")).toBe(formatDate(MOMENT, options, "en"));
    });

    it("never throws on a bad date", () => {
        expect(formatDateTime("not a date")).toBe("Invalid Date");
    });
});