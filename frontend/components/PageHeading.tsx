import type { ReactNode } from "react";

// the title block that opens each dashboard view
export function PageHeading({ title, subtitle }: Readonly<{ title: string; subtitle: ReactNode }>) {
    return (
        <div
            className="dashboard-section"
            style={{
                borderBottom: "1px solid var(--brand-border)",
                paddingBottom: "var(--space-4)"
            }}
        >
            <h1 className="dashboard-title">{title}</h1>
            <p className="dashboard-subtitle">{subtitle}</p>
        </div>
    );
}