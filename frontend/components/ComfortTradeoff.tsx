"use client";

import { useId } from "react";

export type TradeoffPoint = {
    savings_level: number;
    monthly_savings: number;
    comfort_score: number;
    shed_kw: number;
};

export type TradeoffProfile = {
    comfort_target: number;
    full_monthly_savings: number;
    sweet_spot: TradeoffPoint;
    points: TradeoffPoint[];
};

type ComfortBand = "good" | "strained" | "poor";
type HintTone = "neutral" | "good" | "warn";

const THUMB_WIDTH_PX = 22;
const STRAINED_FLOOR = 60;
const GAUGE_ARC = "M 14 60 A 46 46 0 0 1 106 60";
const BAND_LABELS: Record<ComfortBand, string> = {
    good: "Comfortable",
    strained: "Strained",
    poor: "Uncomfortable"
};

export function comfortBand(score: number, target: number): ComfortBand {
    if (score >= target) {
        return "good";
    }
    if (score >= STRAINED_FLOOR) {
        return "strained";
    }
    return "poor";
}

function formatKw(value: number): string {
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} kW`;
}

function formatZar(value: number): string {
    return `R ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pointAt(profile: TradeoffProfile, level: number): TradeoffPoint {
    return profile.points.find((point) => point.savings_level === level) ?? profile.points[0];
}

function lastLevelAtOrAbove(profile: TradeoffProfile, floor: number): number {
    return profile.points.reduce((last, point) => (point.comfort_score >= floor ? point.savings_level : last), 0);
}

function sliderPosition(level: number): number {
    return 100 - level;
}

function trackBackground(profile: TradeoffProfile): string {
    const comfortableFrom = sliderPosition(profile.sweet_spot.savings_level);
    const strainedFrom = sliderPosition(Math.max(profile.sweet_spot.savings_level, lastLevelAtOrAbove(profile, STRAINED_FLOOR)));

    return [
        "linear-gradient(90deg",
        "var(--brand-danger) 0%",
        `var(--brand-danger) ${strainedFrom}%`,
        `var(--brand-warning) ${strainedFrom}%`,
        `var(--brand-warning) ${comfortableFrom}%`,
        `var(--brand-success) ${comfortableFrom}%`,
        "var(--brand-success) 100%)"
    ].join(", ");
}

function markerOffset(position: number): string {
    return `calc(${position}% + ${((50 - position) / 100) * THUMB_WIDTH_PX}px)`;
}

function describeSetting(adjusted: boolean, point: TradeoffPoint, profile: TradeoffProfile): { tone: HintTone; text: string } {
    if (!adjusted) {
        return {
            tone: "neutral",
            text: "Drag the slider to choose how hard to shave the peak. Approval unlocks once you pick a setting."
        };
    }
    if (point.comfort_score < profile.comfort_target) {
        return {
            tone: "warn",
            text: `Comfort drops below the ${profile.comfort_target}/100 target. Ease back towards Maximum Comfort to protect the people in the building.`
        };
    }
    if (point.savings_level === profile.sweet_spot.savings_level) {
        return {
            tone: "good",
            text: `Sweet spot: ${formatZar(point.monthly_savings)} a month while comfort holds at ${point.comfort_score}/100.`
        };
    }
    return {
        tone: "good",
        text: `Comfort holds at ${point.comfort_score}/100. There is room to save more before it reaches ${profile.comfort_target}/100.`
    };
}

function ComfortGauge({ score, target }: Readonly<{ score: number; target: number }>) {
    const band = comfortBand(score, target);
    return (
        <div className="comfort-gauge">
            <p className="dashboard-kpi-label">Employee comfort</p>
            <svg viewBox="0 0 120 68" width="168" height="95" aria-hidden="true" focusable="false">
                <path className="comfort-gauge-track" d={GAUGE_ARC} pathLength={100} />
                <path className={`comfort-gauge-fill comfort-gauge-${band}`} d={GAUGE_ARC} pathLength={100} strokeDasharray={`${score} 100`} />
            </svg>
            <meter className="sr-only" aria-label="Employee comfort" aria-valuetext={`${score} out of 100, ${BAND_LABELS[band].toLowerCase()}`}
                low={STRAINED_FLOOR}
                high={target}
                min={0}
                max={100}
                optimum={100}
                value={score}
            >
                {`${score} out of 100, ${BAND_LABELS[band].toLowerCase()}`}
            </meter>
            <p className={`comfort-gauge-value comfort-band-${band}`} aria-hidden="true">{score}<span className="comfort-gauge-scale">/100</span></p>
            <p className={`comfort-band-label comfort-band-${band}`} aria-hidden="true">{BAND_LABELS[band]}</p>
        </div>
    );
}

export default function ComfortTradeoff({ profile, level, adjusted, disabled = false, onLevelChange }: Readonly<{
    profile: TradeoffProfile;
    level: number;
    adjusted: boolean;
    disabled?: boolean;
    onLevelChange: (level: number) => void;
}>) {
    const sliderId = useId();
    const point = pointAt(profile, level);
    const hint = describeSetting(adjusted, point, profile);

    return (
        <section className="tradeoff-panel" aria-label="Savings and comfort trade-off">
            <div>
                <p className="dashboard-kpi-label">Savings versus comfort</p>
                <p className="text-muted tradeoff-intro">Shaving the peak harder saves more, but each extra step costs employees more comfort than the one before.</p>
            </div>
            <div className="tradeoff-readouts">
                <div>
                    <p className="dashboard-kpi-label">Projected monthly savings</p>
                    <p className="dashboard-kpi-value metric">{formatZar(point.monthly_savings)}</p>
                    <p className="text-muted tradeoff-subtext">Shifts {formatKw(point.shed_kw)} off the peak. Full strength saves up to {formatZar(profile.full_monthly_savings)}.</p>
                </div>
                <ComfortGauge score={point.comfort_score} target={profile.comfort_target} />
            </div>
            <div className="tradeoff-slider-block">
                <label htmlFor={sliderId} className="dashboard-kpi-label">Savings level</label>
                <input
                    id={sliderId}
                    type="range"
                    className="tradeoff-slider"
                    value={sliderPosition(level)}
                    disabled={disabled}
                    min={0}
                    max={100}
                    step={1}
                    style={{ background: trackBackground(profile) }}
                    aria-valuetext={`${formatZar(point.monthly_savings)} a month, comfort ${point.comfort_score} out of 100`}
                    onChange={(event) => onLevelChange(100 - Number(event.target.value))}
                />
                <div className="tradeoff-marker-row" aria-hidden="true">
                    <span className="tradeoff-marker" style={{ left: markerOffset(sliderPosition(profile.sweet_spot.savings_level)) }}>Sweet spot</span>
                </div>
                <div className="tradeoff-scale">
                    <span>Aggressive Savings</span>
                    <span>Maximum Comfort</span>
                </div>
            </div>
            <p className={`tradeoff-hint tradeoff-hint-${hint.tone}`} aria-live="polite">{hint.text}</p>
        </section>
    );
}