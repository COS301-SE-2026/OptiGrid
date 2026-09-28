import { existsSync } from "fs";
import { join } from "path";
import Link from "next/link";

const SILENT_CAPTIONS_URL = "/help/tutorials/no-audio.vtt";

type Tutorial = {
    title: string;
    description: string;
    sourceUrl: string;
    posterUrl?: string;
    // true only when the clip has spoken narration
    hasAudio?: boolean;
    captionsUrl?: string;
    // text alternative for the video, one step per line
    steps: string;
};

function toSteps(block: string): string[] {
    return block.split("\n").map((step) => step.trim()).filter(Boolean);
}

function hasPublicFile(url: string | undefined): url is string {
    if (!url) {
        return false;
    }
    return existsSync(join(process.cwd(), "public", url));
}

const tutorials: Tutorial[] = [
    {
        title: "Add a building",
        description: "Add a new building so OptiGrid can track it and include it in forecasts.",
        sourceUrl: "/help/tutorials/add_building.mp4",
        posterUrl: "/help/tutorials/add_building-poster.jpg",
        steps: `
            From the dashboard, select "+ Add building".
            Type the building name. It is the only field you must fill in.
            Pick a building type from the list.
            Enter the street address and press "Validate". The coordinates fill in for you.
            Add the floor area and the number of floors. The 3D model uses them for its shape.
            Set a circuit limit if yours is not 60 A. Rooftop solar has its own field.
            Leave the timezone empty to use UTC.
            Select "Add building". You go back to the dashboard and the new building shows in the table.
        `,
    },
    {
        title: "Compare two buildings",
        description: "Put two buildings side by side to see which one uses more.",
        sourceUrl: "/help/tutorials/compare_buildings.mp4",
        posterUrl: "/help/tutorials/compare_buildings-poster.jpg",
        steps: `
            Open "Compare" from the sidebar. It opens with your two busiest buildings.
            Pick other buildings under Building 1 and Building 2 if you want.
            Choose a date range. You can look back up to 90 days.
            Set Metric to Cost or Energy.
            Each building gets a card with its total for the period.
            The Comparison totals chart plots both buildings day by day.
            Key insights show the efficiency ratio per m² and the total difference.
        `,
    },
    {
        title: "Use the energy heatmap",
        description: "See which sites use the most energy on a map. You can also look back in time or ahead.",
        sourceUrl: "/help/tutorials/heatmap.mp4",
        posterUrl: "/help/tutorials/heatmap-poster.jpg",
        steps: `
            Open "Heatmap" from the sidebar.
            Each building sits on the map as a coloured dot. Green means low use and red means high use.
            Choose "Total" to compare overall use. "Per m²" compares use against floor area instead.
            The cards at the top show the portfolio total and the hottest site.
            Drag the timeline to look back up to 90 days. Anything to the right of Live is the forecast.
            Press play to step through each period.
            Select "Towers" to turn each site into a 3D column. A taller tower means higher use.
            "Show all buildings" zooms out to fit every site on screen.
            Click a dot or a row under Hotspots to open its card. It shows the rank and the portfolio share.
            From that card you can open the 3D twin or the building details.
            Sites without a location are listed under "Not on the map". Admins and managers can place them from the address or by hand.
        `,
    },
    {
        title: "Explore the digital twin",
        description: "Look around a 3D model of any building and check the live load on each sensor.",
        sourceUrl: "/help/tutorials/digital_twin.mp4",
        posterUrl: "/help/tutorials/digital_twin-poster.jpg",
        steps: `
            Open a building from the dashboard table. You can also choose "Open 3D twin" on the heatmap.
            The Digital twin section shows a model built from the building type and size.
            Drag to turn the model and scroll to zoom. "Reset view" puts the camera back.
            Every sensor sits in its zone and glows with its live load.
            "Circuit load" compares each sensor with the circuit limit. "Deviation" compares it with its own normal use.
            Cards above the model show the live load and how many sensors need attention.
            Select a sensor in the model or in the Sensors list to see its readings.
            Use "Full view" for a bigger model. "Exit full view" takes you back.
        `,
    },
    {
        title: "Review demand forecasts",
        description: "Check how much energy a building is likely to need in the coming days or weeks.",
        sourceUrl: "/help/tutorials/run_forecast.mp4",
        posterUrl: "/help/tutorials/run_forecast-poster.jpg",
        steps: `
            Open "Forecast" from the sidebar. A 7 day forecast for your busiest building runs straight away.
            To see another one, pick a building and a horizon. Weekly looks 7 days ahead while Monthly looks 12 weeks ahead.
            Select "Run forecast".
            The Demand trend chart shows past use as a solid line. The forecast carries on as a dashed line.
            A shaded band may appear around the forecast. Real demand will most likely fall inside it.
            Cards below the chart show the peak demand and the average use.
            Model accuracy shows the MAPE. A lower number means a closer forecast.
        `,
    },
    {
        title: "Review insights",
        description: "Read the load shifting ideas OptiGrid suggests. Managers can approve or dismiss them.",
        sourceUrl: "/help/tutorials/review_insights.mp4",
        posterUrl: "/help/tutorials/review_insights-poster.jpg",
        steps: `
            Open "Insights" from the sidebar. It opens on your busiest building.
            Pick another building if you need to. Use the Status filter if you only want to see some recommendations.
            The cards at the top count the active recommendations. They also add up the monthly saving on offer.
            Each recommendation explains the idea in plain words. It also shows the saving and when to shift the load.
            Admins and managers can select "Review" to open one.
            Some recommendations have a Savings level slider. Drag it between Aggressive Savings and Maximum Comfort. The Sweet spot mark shows a good balance.
            Select "Approve Recommendation" to apply it. If the slider is shown you need to pick a level first.
            "Dismiss" rejects the recommendation. "Close" leaves it as it is.
        `,
    },
    {
        title: "View anomaly alerts",
        description: "Find readings that moved outside the normal range for a building.",
        sourceUrl: "/help/tutorials/review_anomaly.mp4",
        posterUrl: "/help/tutorials/review_anomaly-poster.png",
        steps: `
            Open "Anomaly" from the sidebar. Building managers and viewers have this page.
            The cards at the top count every alert. They also show how many are open or critical.
            The Energy consumption chart compares actual use with the expected use for one building.
            Filter the alerts by building or severity. You can also search by text.
            Select an alert in the Current anomalies table to see its details.
            Managers can choose "Resolve" or "Ignore" there. Viewers can read the details.
            "View Historic Alerts" lists older alerts.
            Managers can set their own limits with "Configure Threshold".
        `,
    },
    {
        title: "Manage your profile and settings",
        description: "Update your details and switch themes. You can also log out or delete your account.",
        sourceUrl: "/help/tutorials/manage_account.mp4",
        posterUrl: "/help/tutorials/manage_account-poster.jpg",
        steps: `
            Open "Settings" near the bottom of the sidebar.
            Profile Information shows your name and email. Your role is shown too but you cannot change it.
            Edit a field and select "Save Changes". "Reset" undoes your edits.
            The Theme card switches between light and dark mode.
            Account Management holds "Logout" and "Delete Account".
            Deleted your account by mistake? Log in with the same details and choose "Recover account".
            Help & Contact links to the Help Centre and the Contact page.
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
    const hasVideo = hasPublicFile(tutorial.sourceUrl);
    const poster = hasPublicFile(tutorial.posterUrl) ? tutorial.posterUrl : undefined;

    return (
        <li className="card help-guide-card tutorial-card" aria-label={`Tutorial: ${tutorial.title}`}>
            <div className="tutorial-card-frame">
                {hasVideo ? (
                    <video
                        className="tutorial-video"
                        controls
                        preload={poster ? "none" : "metadata"}
                        poster={poster}
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
                        aria-label={`${tutorial.title} video coming soon`}
                    >
                        <div className="tutorial-video-placeholder-content">
                            <div className="tutorial-video-icon" aria-hidden="true">
                                <PlayGlyph />
                            </div>
                            <span className="tutorial-video-chip">Video coming soon</span>
                            <p className="tutorial-video-copy">The written steps below cover everything in the meantime.</p>
                        </div>
                    </div>
                )}
            </div>
            <div className="tutorial-card-body">
                <h2 className="tutorial-card-title">{tutorial.title}</h2>
                <p className="text-muted">{tutorial.description}</p>
                {hasVideo && !tutorial.hasAudio ? (
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
    description: "Short OptiGrid tutorials for building management and portfolio workflows.",
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
                        <Link href="/dashboard" className="btn btn-primary">
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
                                Short videos for the tasks you do most. Each one comes with written steps you can read instead.
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