"use client";

import { useEffect, useState, type ReactNode } from "react";

export function SessionNavActions({
    signedInActions,
    children,
}: Readonly<{
    signedInActions: ReactNode;
    children: ReactNode;
}>) {
    const [signedIn, setSignedIn] = useState(false);

    useEffect(() => {
        let active = true;
        const checkSession = async () => {
            try {
                const response = await fetch("/api/auth/session?probe=1", { cache: "no-store" });
                if (active && response.status === 200) {
                    setSignedIn(true);
                }
            } catch {
                // without an answer the log in links stay where they are
            }
        };
        void checkSession();
        return () => {
            active = false;
        };
    }, []);

    return <>{signedIn ? signedInActions : children}</>;
}