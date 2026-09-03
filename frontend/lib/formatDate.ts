function stringToDate(val: string | null): Date | null {
    if (!val) {
        return null;
    }
    const date = new Date(val);

    if (Number.isNaN(date.getTime())) {
        return null;
    } 
    else {
        return date;
    }
}

export function formatDate(val: string | null): string {
    const date = stringToDate(val);

    if (!date) {
        return "-";
    }

    return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
}

export function formatDateTime(val: string | null): string {
    const date = stringToDate(val);
    
    if (!date) {
        return "-";
    }

    return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
}