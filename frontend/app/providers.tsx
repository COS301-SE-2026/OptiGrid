"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { TabSessionProvider } from "./tab-session-provider";
import { useDisplayPreferences } from "../lib/useDisplayPreferences";
import { reloadDisplayPreferences } from "../lib/displayPreferences";

// coming back to the tab does not trigger a fresh round of requests
function LiveUpdateDefaults({ client }: Readonly<{ client: QueryClient }>) {
    const { liveUpdates } = useDisplayPreferences();

    useEffect(() => {
        reloadDisplayPreferences();
    }, []);

    useEffect(() => {
        const defaults = client.getDefaultOptions();
        client.setDefaultOptions({
            ...defaults,
            queries: { ...defaults.queries, refetchOnWindowFocus: liveUpdates === "normal" },
        });
    }, [client, liveUpdates]);

    return null;
}

export function Providers({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient());
    return (
        <QueryClientProvider client={client}>
            <LiveUpdateDefaults client={client} />
            <TabSessionProvider>
                <ThemeProvider>{children}</ThemeProvider>
            </TabSessionProvider>
        </QueryClientProvider>
    );
}
