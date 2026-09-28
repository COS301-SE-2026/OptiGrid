export default function DashboardLoading() {
    return (
        <div className="page-loading" aria-busy="true">
            <span className="sr-only" role="status">Loading page</span>
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