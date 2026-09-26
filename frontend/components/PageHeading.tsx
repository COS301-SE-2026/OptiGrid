import type { ReactNode } from "react";

// the title block that opens each dashboard view
export function PageHeading({ title, subtitle }: Readonly<{ title: string; subtitle: ReactNode }>) {
    return (
        <div className="dashboard-section dashboard-page-heading">
            <h1 className="dashboard-title">{title}</h1>
            <p className="dashboard-subtitle">{subtitle}</p>
        </div>
    );
}