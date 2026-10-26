"use client";

import { setDisplayPreferences } from "@/lib/displayPreferences";
import { useDisplayPreferences } from "@/lib/useDisplayPreferences";

export function LiveUpdatesNotice() {
    const { liveUpdates } = useDisplayPreferences();

    if (liveUpdates !== "paused") {
        return null;
    }

    return (
        <div className="live-updates-notice" role="status">
            <span className="live-updates-notice-dot" aria-hidden="true" />
            <p>Live updates are paused on this device. Pages refresh only when you open or reload them.</p>
            <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDisplayPreferences({ liveUpdates: "normal" })}
            >
                Resume live updates
            </button>
        </div>
    );
}