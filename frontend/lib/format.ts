import { formatPreferencesActive, getFormatPreferences, type ClockFormat, type RegionFormat } from "./displayPreferences";

export const REGION_LOCALES: Readonly<Record<Exclude<RegionFormat, "default">, string>> = {
    za: "en-ZA",
    gb: "en-GB",
    us: "en-US",
};

type DateInput = Date | string | number;

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

// the server cannot see the browser locale. the browser prints with this one as well until a page has hydrated
const SERVER_LOCALE = "en-US";

// with the default choice, every screen keeps the locale it used before the setting existed
function resolveLocale(defaultLocale: string | undefined): string | undefined {
    const { region } = getFormatPreferences();
    if (region !== "default") {
        return REGION_LOCALES[region];
    }
    if (defaultLocale !== undefined) {
        return defaultLocale;
    }
    return formatPreferencesActive() ? undefined : SERVER_LOCALE;
}

function cacheKey(locale: string | undefined, options: object): string {
    return `${locale ?? "device"}|${JSON.stringify(options)}`;
}

function numberFormatter(locale: string | undefined, options: Intl.NumberFormatOptions): Intl.NumberFormat {
    const key = cacheKey(locale, options);
    let formatter = numberFormats.get(key);
    if (!formatter) {
        formatter = new Intl.NumberFormat(locale, options);
        numberFormats.set(key, formatter);
    }
    return formatter;
}

function dateFormatter(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = cacheKey(locale, options);
    let formatter = dateFormats.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, options);
        dateFormats.set(key, formatter);
    }
    return formatter;
}

export function applyClock(options: Intl.DateTimeFormatOptions, clock: ClockFormat): Intl.DateTimeFormatOptions {
    const showsTime = options.hour !== undefined || options.timeStyle !== undefined;
    if (clock === "default" || !showsTime) {
        return options;
    }

    const adjusted: Intl.DateTimeFormatOptions = { ...options, hourCycle: clock === "24h" ? "h23" : "h12" };
    delete adjusted.hour12;
    return adjusted;
}

export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}, defaultLocale?: string): string {
    return numberFormatter(resolveLocale(defaultLocale), options).format(value);
}

export function formatDateTime(
    value: DateInput,
    options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
    defaultLocale?: string,
): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Invalid Date";
    }
    const { clock } = getFormatPreferences();
    return dateFormatter(resolveLocale(defaultLocale), applyClock(options, clock)).format(date);
}

export function formatDate(value: DateInput, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }, defaultLocale?: string): string {
    return formatDateTime(value, options, defaultLocale);
}

export function formatTime(
    value: DateInput,
    options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", second: "2-digit" },
    defaultLocale?: string,
): string {
    return formatDateTime(value, options, defaultLocale);
}