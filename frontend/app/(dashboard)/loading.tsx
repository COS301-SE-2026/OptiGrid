export default function DashboardLoading() {
    return (
        <div className="page-loading" aria-busy="true">
            <output className="sr-only">Loading page</output>
            <div className="skeleton page-loading-title" />
            <div className="skeleton page-loading-subtitle" />
            <div className="page-loading-cards">
                <div className="skeleton" />
                <div className="skeleton" />
                <div className="skeleton" />
                <div className="skeleton" />
            </div>
            <div className="skeleton page-loading-panel" />
        </div>
    );
}