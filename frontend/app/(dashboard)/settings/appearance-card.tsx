"use client";

import { useRef, useState } from "react";
import { useTheme, type ThemePreference } from "@/app/theme-provider";
import { MotionSetting } from "./display-settings";

type SyncState = "idle" | "saving" | "saved" | "failed";

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; hint: string }> = [
  { value: "light", label: "Light", hint: "Bright and clear for daytime work." },
  { value: "dark", label: "Dark", hint: "Softer on the eyes in low light." },
  { value: "system", label: "System", hint: "Matches the setting on your device." },
];

function PreviewWindow({ palette, split = false }: Readonly<{ palette: "light" | "dark"; split?: boolean }>) {
  return (
    <span className={`theme-preview-window theme-preview-${palette}${split ? " theme-preview-split" : ""}`}>
      <span className="theme-preview-sidebar">
        <span className="theme-preview-dot" />
        <span className="theme-preview-nav" />
        <span className="theme-preview-nav" />
      </span>
      <span className="theme-preview-body">
        <span className="theme-preview-line theme-preview-line-short" />
        <span className="theme-preview-tiles">
          <span className="theme-preview-tile theme-preview-tile-accent" />
          <span className="theme-preview-tile" />
        </span>
        <span className="theme-preview-line" />
      </span>
    </span>
  );
}

// The System preview shows both palettes, cut along a diagonal.
function ThemePreview({ variant }: Readonly<{ variant: ThemePreference }>) {
  return (
    <span className="theme-preview" aria-hidden="true">
      {variant === "system" ? (
        <>
          <PreviewWindow palette="light" />
          <PreviewWindow palette="dark" split />
        </>
      ) : (
        <PreviewWindow palette={variant} />
      )}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function AppearanceCard() {
  const { theme, preference, setPreference } = useTheme();
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const latestChange = useRef(0);

  const choose = async (next: ThemePreference) => {
    if (next === preference) {
      return;
    }

    setPreference(next);
    const changeId = latestChange.current + 1;
    latestChange.current = changeId;
    setSyncState("saving");

    try {
      const response = await fetch("/api/preferences/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      if (changeId === latestChange.current) {
        setSyncState(response.ok ? "saved" : "failed");
      }
    } catch {
      if (changeId === latestChange.current) {
        setSyncState("failed");
      }
    }
  };

  let status = preference === "system"
    ? `Following your device, which is in ${theme} mode right now.`
    : "Saved to your account. It follows you to other devices.";
  if (syncState === "saving") {
    status = "Saving your choice...";
  } 
  else if (syncState === "failed") {
    status = "Saved on this device only. We could not reach your account just now.";
  }

  return (
    <section aria-labelledby="settings-appearance-title" className="card settings-card">
      <h2 id="settings-appearance-title" className="dashboard-section-title settings-card-title">Appearance</h2>
      <fieldset className="theme-options">
        <legend className="settings-legend">Theme</legend>
        {THEME_OPTIONS.map((option) => {
          const selected = preference === option.value;
          return (
            <label key={option.value} className={`theme-option${selected ? " is-selected" : ""}`}>
              <input
                type="radio"
                name="theme-preference"
                value={option.value}
                checked={selected}
                onChange={() => void choose(option.value)}
                className="theme-option-input"
                aria-labelledby={`theme-${option.value}-label`}
                aria-describedby={`theme-${option.value}-hint`}
              />
              <ThemePreview variant={option.value} />
              <span className="theme-option-text">
                <span id={`theme-${option.value}-label`} className="theme-option-label">{option.label}</span>
                <span id={`theme-${option.value}-hint`} className="theme-option-hint">{option.hint}</span>
              </span>
              <span className="theme-option-check">
                <CheckIcon />
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className={`settings-note${syncState === "failed" ? " is-warning" : ""}`} role="status" aria-live="polite">
        {status}
      </p>
      <MotionSetting />
    </section>
  );
}