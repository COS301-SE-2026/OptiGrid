"use client";

import { useEffect, useId, useState } from "react";
import {
  LIVE_REFRESH_MS,
  liveInterval,
  setDisplayPreferences,
  type ClockFormat,
  type GraphicsQuality,
  type LiveUpdateMode,
  type MotionPreference,
  type RegionFormat,
} from "@/lib/displayPreferences";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { useDeviceReducedMotion, useDisplayPreferences, useFormatPreferences, useReducedMotion } from "@/lib/useDisplayPreferences";

type Choice<T extends string> = { value: T; label: string };

const MOTION_CHOICES: ReadonlyArray<Choice<MotionPreference>> = [
  { value: "system", label: "Match device" },
  { value: "reduce", label: "Reduce" },
  { value: "full", label: "Full" },
];

const LIVE_CHOICES: ReadonlyArray<Choice<LiveUpdateMode>> = [
  { value: "normal", label: "Normal" },
  { value: "saver", label: "Data saver" },
  { value: "paused", label: "Paused" },
];

const GRAPHICS_CHOICES: ReadonlyArray<Choice<GraphicsQuality>> = [
  { value: "auto", label: "Auto" },
  { value: "saver", label: "Battery saver" },
  { value: "high", label: "High" },
];

const REGION_CHOICES: ReadonlyArray<Choice<RegionFormat>> = [
  { value: "default", label: "Default" },
  { value: "za", label: "South Africa" },
  { value: "gb", label: "United Kingdom" },
  { value: "us", label: "United States" },
];

const CLOCK_CHOICES: ReadonlyArray<Choice<ClockFormat>> = [
  { value: "default", label: "Default" },
  { value: "24h", label: "24-hour" },
  { value: "12h", label: "12-hour" },
];

const LIVE_NOTES: Record<LiveUpdateMode, string> = {
  normal: "Readings stream in the moment sensors send them.",
  saver: "Live streams stay closed and pages check for new data less often.",
  paused: "Nothing refreshes on its own. Anomaly alerts still arrive.",
};

const GRAPHICS_NOTES: Record<GraphicsQuality, string> = {
  auto: "Starts sharp and lowers the resolution when your device struggles.",
  saver: "Draws a still scene at a lower resolution. A good fit for laptops on battery.",
  high: "Keeps full resolution with smooth edges. Needs a capable graphics card.",
};

const REGION_NOTES: Record<RegionFormat, string> = {
  default: "Each screen keeps the format it always used. Numbers follow your browser.",
  za: "Spaces group thousands and a comma marks decimals.",
  gb: "Day before month, with commas between thousands.",
  us: "Month before day, with commas between thousands.",
};

const REFRESH_ROWS: ReadonlyArray<{ page: string; baseMs: number; streams: boolean }> = [
  { page: "Live readings", baseMs: LIVE_REFRESH_MS.liveReadings, streams: true },
  { page: "Dashboard", baseMs: LIVE_REFRESH_MS.dashboard, streams: false },
  { page: "Heatmap", baseMs: LIVE_REFRESH_MS.heatmap, streams: true },
  { page: "3D building model", baseMs: LIVE_REFRESH_MS.twinSnapshot, streams: true },
];

// a fixed moment keeps the preview identical on the server and on the browser
const SAMPLE_MOMENT = new Date(2026, 9, 25, 14, 5);

export function describeRefresh(baseMs: number, streams: boolean, mode: LiveUpdateMode): string {
  const interval = liveInterval(baseMs, mode);
  if (interval === false) {
    return "Paused";
  }
  if (mode === "normal" && streams) {
    return "As it happens";
  }
  if (interval < 60_000) {
    return `Every ${Math.round(interval / 1000)} seconds`;
  }
  const minutes = Math.round(interval / 60_000);
  return minutes === 1 ? "Every minute" : `Every ${minutes} minutes`;
}

function ChoiceGroup<T extends string>({
  legend,
  name,
  choices,
  value,
  onChange,
  noteId,
}: Readonly<{
  legend: string;
  name: string;
  choices: ReadonlyArray<Choice<T>>;
  value: T;
  onChange: (value: T) => void;
  noteId: string;
}>) {
  return (
    <fieldset className="choice-group" aria-describedby={noteId}>
      <legend className="settings-legend">{legend}</legend>
      <div className={`choice-options${choices.length === 4 ? " is-two-columns" : ""}`}>
        {choices.map((choice) => {
          const selected = value === choice.value;
          return (
            <label key={choice.value} className={`choice-option${selected ? " is-selected" : ""}`}>
              <input
                type="radio"
                name={name}
                value={choice.value}
                checked={selected}
                onChange={() => onChange(choice.value)}
                className="choice-input"
              />
              <span>{choice.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function MotionSetting() {
  const { motion } = useDisplayPreferences();
  const deviceReduced = useDeviceReducedMotion();
  const reduced = useReducedMotion();
  const noteId = useId();

  let note = deviceReduced
    ? "Your device asks for less motion. OptiGrid keeps animations off."
    : "Your device allows motion. Charts and live markers animate as usual.";
  if (motion === "reduce") {
    note = "Animations stay off on this device. Charts appear at once and the 3D model holds still.";
  } else if (motion === "full") {
    note = "Animations play on this device, even when your system asks for less motion.";
  }

  return (
    <div className="settings-subsection">
      <ChoiceGroup
        legend="Motion"
        name="motion-preference"
        choices={MOTION_CHOICES}
        value={motion}
        onChange={(value) => setDisplayPreferences({ motion: value })}
        noteId={noteId}
      />
      <div className="motion-preview" aria-hidden="true">
        <span className="motion-preview-track">
          <span className="motion-preview-dot" />
        </span>
        <span className="motion-preview-label">{reduced ? "Still" : "Moving"}</span>
      </div>
      <p id={noteId} className="settings-note">{note}</p>
    </div>
  );
}

export function PerformanceCard() {
  const { liveUpdates, graphics } = useDisplayPreferences();
  const liveNoteId = useId();
  const graphicsNoteId = useId();
  const [pixelRatio, setPixelRatio] = useState<number | null>(null);

  useEffect(() => {
    setPixelRatio(globalThis.devicePixelRatio || 1);
  }, []);

  return (
    <section aria-labelledby="settings-performance-title" className="card settings-card">
      <h2 id="settings-performance-title" className="dashboard-section-title settings-card-title">Performance</h2>

      <div className="settings-subsection">
        <ChoiceGroup
          legend="Live updates"
          name="live-updates"
          choices={LIVE_CHOICES}
          value={liveUpdates}
          onChange={(value) => setDisplayPreferences({ liveUpdates: value })}
          noteId={liveNoteId}
        />
        <p id={liveNoteId} className="settings-note">{LIVE_NOTES[liveUpdates]}</p>
        <table className="refresh-table">
          <caption className="sr-only">How often each page updates with this choice</caption>
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col">Updates</th>
            </tr>
          </thead>
          <tbody>
            {REFRESH_ROWS.map((row) => (
              <tr key={row.page}>
                <th scope="row">{row.page}</th>
                <td>{describeRefresh(row.baseMs, row.streams, liveUpdates)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="settings-subsection">
        <ChoiceGroup
          legend="3D graphics"
          name="graphics-quality"
          choices={GRAPHICS_CHOICES}
          value={graphics}
          onChange={(value) => setDisplayPreferences({ graphics: value })}
          noteId={graphicsNoteId}
        />
        <p id={graphicsNoteId} className="settings-note">
          {GRAPHICS_NOTES[graphics]} It applies to the 3D building model and the heatmap.
          {pixelRatio !== null && ` This screen has a pixel density of ${formatNumber(pixelRatio, { maximumFractionDigits: 2 })}x.`}
        </p>
      </div>

      <p className="settings-field-hint settings-device-note">These choices are saved on this device only.</p>
    </section>
  );
}

export function FormatsCard() {
  const { region, clock } = useFormatPreferences();
  const regionNoteId = useId();
  const clockNoteId = useId();

  const clockNote = clock === "default"
    ? "Each screen keeps the clock it always used."
    : `Times show on a ${clock === "24h" ? "24-hour" : "12-hour"} clock everywhere.`;

  return (
    <section aria-labelledby="settings-formats-title" className="card settings-card">
      <h2 id="settings-formats-title" className="dashboard-section-title settings-card-title">Dates and numbers</h2>

      <div className="settings-subsection">
        <ChoiceGroup
          legend="Region format"
          name="region-format"
          choices={REGION_CHOICES}
          value={region}
          onChange={(value) => setDisplayPreferences({ region: value })}
          noteId={regionNoteId}
        />
        <p id={regionNoteId} className="settings-note">{REGION_NOTES[region]}</p>
      </div>

      <div className="settings-subsection">
        <ChoiceGroup
          legend="Clock"
          name="clock-format"
          choices={CLOCK_CHOICES}
          value={clock}
          onChange={(value) => setDisplayPreferences({ clock: value })}
          noteId={clockNoteId}
        />
        <p id={clockNoteId} className="settings-note">{clockNote}</p>
      </div>

      <div className="format-preview" aria-live="polite">
        <p className="settings-list-title">Preview</p>
        <dl className="format-preview-grid">
          <div>
            <dt>Date</dt>
            <dd>{formatDate(SAMPLE_MOMENT, { day: "numeric", month: "short", year: "numeric" }, "en")}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{formatTime(SAMPLE_MOMENT, { hour: "2-digit", minute: "2-digit", hour12: false }, "en")}</dd>
          </div>
          <div>
            <dt>Energy</dt>
            <dd>{formatNumber(12480.5, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh</dd>
          </div>
          <div>
            <dt>Cost</dt>
            <dd>R {formatNumber(23456.78, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
          </div>
        </dl>
      </div>

      <p className="settings-field-hint settings-device-note">These choices are saved on this device only.</p>
    </section>
  );
}