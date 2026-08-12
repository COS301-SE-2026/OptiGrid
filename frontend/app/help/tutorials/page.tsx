import Link from "next/link";

// ok so every rendered <video> must carry a <track>
const SILENT_CAPTIONS_URL = "/help/tutorials/no-audio.vtt";

type Tutorial = {
    title: string;
    description: string;
    sourceUrl?: string;
    // set only when a clip carries spoken narration and otherwise default to silent
    hasAudio?: boolean;
    // defaults to SILENT_CAPTIONS_URL
    captionsUrl?: string;
    // Text alternative required by WCAG 1.2.1 for video-only content one step per line and blank lines are ignored
    steps: string;
};

function toSteps(block: string): string[] {
    return block.split("\n").map((step) => step.trim()).filter(Boolean);
}

const tutorials: Tutorial[] = [
    {
        title: "Sign up for an OptiGrid account",
        description: "Walk through the first-time registration flow and learn what details are required before you can access the platform.",
        sourceUrl: "/help/tutorials/signup.mp4",
        steps: `
            Open the OptiGrid landing page and choose "Get started free".
            Enter your first name, last name and work email address.
            Choose a password of at least 8 characters, then re-enter it to confirm.
            Select "Create account". OptiGrid validates each field and shows an inline message beneath any field that needs attention.
            On success you are redirected to the login page with a confirmation message.
        `,
    },
    {
        title: "Log in",
        description: "See the standard login flow.",
        sourceUrl: "/help/tutorials/login.mp4",
        steps: `
            Open the login page from the landing page or the "Log in" link.
            Enter the work email and password used at registration.
            Select "Log in".
            If the credentials are not recognised, an error message appears above the form explaining what to correct.
            On success you land on the dashboard, which shows your portfolio overview.
        `,
    },
    {
        title: "Add a building",
        description: "Create a new building record so it can be tracked, compared, and included in forecasts.",
        sourceUrl: "/help/tutorials/add_building.mp4",
        steps: `
            From the dashboard, select "+ Add building".
            Enter the building name (required) and pick a building type from the dropdown.
            Optionally add the physical address, floor area, and maximum occupancy.
            Optionally set the nominal voltage and maximum current threshold used for alerting.
            Optionally add the timezone and location details (geohash, latitude, longitude).
            Select "Add building". The new building appears in your dashboard table.
        `,
    },
    {
        title: "Compare two buildings",
        description: "Compare building performance side by side to identify which sites are using more energy than expected.",
        sourceUrl: "/help/tutorials/compare_buildings.mp4",
        steps: `
            Open "Compare" from the main navigation.
            Choose the first building from the left dropdown and the second from the right dropdown.
            Pick the date range and choose whether to compare cost or energy.
            The chart redraws to plot both buildings over the selected period.
            Below the chart, the key insights panel reports the efficiency ratio per square metre and the total difference between the two buildings.
        `,
    },
    {
        title: "Review demand forecasts",
        description: "Check the forecast view to see how OptiGrid projects near-term demand for your selected building.",
        sourceUrl: "/help/tutorials/run_forecast.mp4",
        steps: `
            Open "Forecast" from the main navigation.
            Select a building and choose either the weekly or monthly horizon.
            Run the forecast. A chart plots predicted demand as a dashed line against recorded history.
            The summary cards beneath the chart show the selected building, the number of forecast points, and the projected peak timestamp.
        `,
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

function slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
    const slug = slugify(tutorial.title);
    const stepsId = `${slug}-steps`;

    return (
        <li className="card help-guide-card tutorial-card" aria-label={`Tutorial: ${tutorial.title}`}>
            <div className="tutorial-card-frame">
                {tutorial.sourceUrl ? (
                    <video
                        className="tutorial-video"
                        controls
                        preload="none"
                        poster="/help/tutorials/tutorial-poster.svg"
                        aria-label={`Tutorial video: ${tutorial.title}`}
                        aria-describedby={stepsId}
                    >
                        <source src={tutorial.sourceUrl} type="video/mp4" />
                        <track
                            kind="captions"
                            src={tutorial.captionsUrl ?? SILENT_CAPTIONS_URL}
                            srcLang="en"
                            label="English"
                            default
                        />
                        Your browser does not support this video element. The written
                        steps for this tutorial are listed below the video.
                    </video>
                ) : (
                    <div
                        className="tutorial-video tutorial-video-placeholder"
                        role="img"
                        aria-label={`${tutorial.title} video placeholder - content not yet available`}
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
                <h2 style={{ fontSize: "var(--fs-h3)", fontWeight: "var(--fw-semibold)", fontFamily: "var(--font-heading)" }}>
                    {tutorial.title}
                </h2>
                <p className="text-muted">{tutorial.description}</p>
                {!tutorial.hasAudio ? (
                    <p className="tutorial-media-note">
                        This tutorial is a silent screen recording. The written steps below describe everything shown on screen.
                    </p>
                ) : null}
                <details className="tutorial-transcript" id={stepsId}>
                    <summary>Written steps</summary>
                    <ol className="tutorial-step-list">
                        {toSteps(tutorial.steps).map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
                </details>
            </div>
        </li>
    );
}

export const metadata = {
    title: "Tutorials - OptiGrid",
    description: "Short OptiGrid tutorials for signup, login, and building management workflows.",
};

export default function TutorialsPage() {
    return (
        <div className="landing-page tutorials-page">
            <header className="navbar landing-nav" role="banner" aria-label="Site header">
                <div className="landing-shell landing-nav-inner">
                    <Link href="/help" className="landing-wordmark" aria-label="OptiGrid help centre home">
                        OptiGrid
                    </Link>
                    <div className="landing-nav-actions">
                        <Link href="/help/manual" className="btn btn-secondary">
                            Open manual
                        </Link>
                        <Link href="/dashboard" className="btn btn-primary" style={{
                            backgroundColor: "#3A6B7C",
                            color: "#FFFFFF",
                        }}>
                            Back to dashboard
                        </Link>
                    </div>
                </div>
            </header>
            <main role="main" aria-label="Tutorials main content">
                <section
                    id="tutorial-library"
                    className="landing-section landing-section-alt help-anchor tutorials-section"
                    aria-label="Tutorial library"
                >
                    <div className="landing-shell">
                        <div className="landing-section-header">
                            <p className="landing-kicker">Tutorial library</p>
                            <h1>Learn OptiGrid in just a few minutes.</h1>
                            <p className="text-muted">
                                Watch short, practical guides for the most common tasks: signing up,
                                managing your buildings, comparing performance, and checking forecasts.
                                Every tutorial also includes written steps you can read instead of watching the video.
                            </p>
                        </div>
                        <ul className="tutorial-grid" aria-label="List of available tutorials">
                            {tutorials.map((tutorial) => (
                                <TutorialCard key={tutorial.title} tutorial={tutorial} />
                            ))}
                        </ul>
                    </div>
                </section>
            </main>
            <footer className="landing-footer" role="contentinfo" aria-label="Site footer">
                <div className="landing-shell">
                    <span>© 2026 OptiGrid. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}