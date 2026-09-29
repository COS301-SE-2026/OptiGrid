import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import tutorials from "./tutorials.json";

const SILENT_CAPTIONS_URL = "/help/tutorials/no-audio.vtt";

type Tutorial = {
    title: string;
    description: string;
    sourceUrl: string;
    posterUrl?: string;
    // true only when the clip has spoken narration
    hasAudio?: boolean;
    captionsUrl?: string;
    // text alternative for the video, one step per item
    steps: string[];
};

function hasPublicFile(url: string | undefined): url is string {
    if (!url) {
        return false;
    }
    return existsSync(join(process.cwd(), "public", url));
}

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
                        {tutorial.steps.map((step) => (
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
                            {(tutorials as Tutorial[]).map((tutorial) => (
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