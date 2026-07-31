import Link from "next/link";

type Tutorial = {
    title: string;
    description: string;
    sourceUrl?: string;
};

const tutorials: Tutorial[] = [
    {
        title: "Sign up for an OptiGrid account",
        description: "Walk through the first-time registration flow and learn what details are required before you can access the platform.",
        sourceUrl: "/help/tutorials/signup.mp4",
    },
    {
        title: "Log in",
        description: "See the standard login flow.",
        sourceUrl: "/help/tutorials/login.mp4",
    },
    {
        title: "Add a building",
        description: "Create a new building record so it can be tracked, compared, and included in forecasts.",
        sourceUrl: "/help/tutorials/add_building.mp4",
    },
    {
        title: "Compare two buildings",
        description: "Compare building performance side by side to identify which sites are using more energy than expected.",
        sourceUrl: "/help/tutorials/compare_buildings.mp4",
    },
    {
        title: "Review demand forecasts",
        description: "Check the forecast view to see how OptiGrid projects near-term demand for your selected building.",
        sourceUrl: "/help/tutorials/run_forecast.mp4",
    },
];

function PlayGlyph() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M10 8l6 4-6 4V8z" />
        </svg>
    );
}

function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
    return (
        <article className="card help-guide-card tutorial-card">
            <div className="tutorial-card-frame">
                {tutorial.sourceUrl ? (
                    <video className="tutorial-video" controls preload="none" poster="/help/tutorials/tutorial-poster.svg">
                        <source src={tutorial.sourceUrl} type="video/mp4" />
                        Your browser does not support this video element.
                    </video>
                ) : (
                    <div
                        className="tutorial-video tutorial-video-placeholder"
                        aria-label={`${tutorial.title} video placeholder`}
                    >
                        <div className="tutorial-video-placeholder-content">
                            <span className="tutorial-video-chip">Source pending</span>
                            <div className="tutorial-video-icon" aria-hidden="true">
                                <PlayGlyph />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="tutorial-card-body">
                <h3>{tutorial.title}</h3>
                <p className="text-muted">{tutorial.description}</p>
            </div>
        </article>
    );
}

export const metadata = {
    title: "Tutorials - OptiGrid",
    description: "Short OptiGrid tutorials for signup, login, and building management workflows.",
};

export default function TutorialsPage() {
    return (
        <div className="landing-page tutorials-page">
            <header className="navbar landing-nav">
                <div className="landing-shell landing-nav-inner">
                    <Link href="/help" className="landing-wordmark">
                        OptiGrid
                    </Link>
                    <div className="landing-nav-actions">
                        <Link href="/help/manual" className="btn btn-secondary">
                            Open manual
                        </Link>
                        <Link href="/dashboard" className="btn btn-primary">
                            Back to dashboard
                        </Link>
                    </div>
                </div>
            </header>
            <main>
                <section
                    id="tutorial-library" className="landing-section landing-section-alt help-anchor tutorials-section">
                    <div className="landing-shell">
                        <div className="landing-section-header">
                            <p className="landing-kicker">Tutorial library</p>
                            <h2>Learn OptiGrid in just a few minutes.</h2>
                            <p className="text-muted">
                                Watch short, practical guides for the most common tasks: signing up,
                                managing your buildings, comparing performance, and checking forecasts.
                            </p>
                        </div>
                        <div className="tutorial-grid">
                            {tutorials.map((tutorial) => (
                                <TutorialCard key={tutorial.title} tutorial={tutorial} />
                            ))}
                        </div>
                    </div>
                </section>
            </main>
            <footer className="landing-footer">
                <div className="landing-shell">
                    <span>© 2026 OptiGrid. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}