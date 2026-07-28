"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { TabSessionProvider } from "./tab-session-provider";

export function Providers({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient());
    return (
        <QueryClientProvider client={client}>
            <TabSessionProvider>
                <ThemeProvider>{children}</ThemeProvider>
            </TabSessionProvider>
        </QueryClientProvider>
    );
}
