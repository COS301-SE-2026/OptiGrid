export function humanise(value: string | null | undefined, fallback = "-"): string {
    const spaced = (value ?? "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    if (!spaced) {
        return fallback;
    }
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}