"use client";

import { useId } from "react";
import { LIVE_INDEX, TIMEFRAMES, describeTimeframe, timeframeAt } from "@/lib/heatmap";

export default function TimelineScrubber({
    index,
    now,
    playing,
    busy,
    onChange,
    onTogglePlay,
    onPreview,
}: Readonly<{
    index: number;
    now: number;
    playing: boolean;
    busy: boolean;
    onChange: (index: number) => void;
    onTogglePlay: () => void;
    onPreview?: (index: number) => void;
}>) {
    const sliderId = useId();
    const frame = timeframeAt(index);
    const lastIndex = TIMEFRAMES.length - 1;
    const livePosition = (LIVE_INDEX / lastIndex) * 100;
    const position = (index / lastIndex) * 100;

    let phase = "Live";
    if (frame.kind === "past") {
        phase = "History";
    } else if (frame.kind === "future") {
        phase = "Forecast";
    }

    return (
        <div className={`heat-timeline heat-timeline-${frame.kind}`}>
            <div className="heat-timeline-head">
                <button
                    type="button"
                    className="heat-play"
                    aria-pressed={playing}
                    aria-label={playing ? "Pause the timeline" : "Play the timeline from the past into the forecast"}
                    onClick={onTogglePlay}
                >
                    {playing ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <rect x="6" y="5" width="4" height="14" rx="1" />
                            <rect x="14" y="5" width="4" height="14" rx="1" />
                        </svg>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
                        </svg>
                    )}
                </button>
                <div className="heat-timeline-readout" aria-live="polite">
                    <span className="heat-timeline-phase">{phase}</span>
                    <span className="heat-timeline-label">{frame.label}</span>
                    <span className="heat-timeline-range">{describeTimeframe(frame, now)}</span>
                </div>
                {busy && <output className="heat-timeline-busy">Loading</output>}
            </div>

            <div className="heat-timeline-track">
                <label htmlFor={sliderId} className="sr-only">Time on the heatmap</label>
                <div className="heat-timeline-rail" aria-hidden="true">
                    <span className="heat-rail-past" style={{ width: `${livePosition}%` }} />
                    <span className="heat-rail-future" style={{ left: `${livePosition}%`, width: `${100 - livePosition}%` }} />
                    <span className="heat-rail-fill" style={{ left: `${Math.min(position, livePosition)}%`, width: `${Math.abs(position - livePosition)}%` }} />
                </div>
                <input
                    id={sliderId}
                    type="range"
                    className="heat-timeline-input"
                    min={0}
                    max={lastIndex}
                    step={1}
                    value={index}
                    aria-valuetext={`${frame.label}, ${describeTimeframe(frame, now)}`}
                    onChange={(event) => onChange(Number(event.target.value))}
                />
                <div className="heat-timeline-stops">
                    {TIMEFRAMES.map((stop, stopIndex) => (
                        <button
                            key={stop.id}
                            type="button"
                            className={stopIndex === index ? `heat-stop heat-stop-${stop.kind} is-active` : `heat-stop heat-stop-${stop.kind}`}
                            style={{ left: `${(stopIndex / lastIndex) * 100}%` }}
                            aria-label={stop.label}
                            aria-pressed={stopIndex === index}
                            onClick={() => onChange(stopIndex)}
                            onMouseEnter={() => onPreview?.(stopIndex)}
                            onFocus={() => onPreview?.(stopIndex)}
                        >
                            {stop.short}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}