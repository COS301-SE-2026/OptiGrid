"use client";

import { useState } from "react";
import { downloadPersonalData } from "./account-api";

type DownloadState = "idle" | "working" | "done" | "failed";

const INCLUDED_IN_EXPORT = [
  "Your profile and sign-in details",
  "Buildings you have access to",
  "Alerts sent to you",
  "A history of your actions in OptiGrid",
];

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 4v11" />
      <path d="M7 10.5l5 5 5-5" />
      <path d="M5 19h14" />
    </svg>
  );
}

export function DataCard({ onNotify }: Readonly<{ onNotify: (message: string) => void }>) {
  const [state, setState] = useState<DownloadState>("idle");
  const [message, setMessage] = useState("");

  const handleDownload = async () => {
    setState("working");
    setMessage("");
    try {
      const fileName = await downloadPersonalData();
      setState("done");
      setMessage(`Saved as ${fileName}`);
      onNotify("Your data is downloading");
    } catch (error) {
      setState("failed");
      setMessage(error instanceof Error && error.message ? error.message : "We could not prepare your file. Please try again in a minute.");
    }
  };

  return (
    <section aria-labelledby="settings-data-title" className="card settings-card">
      <h2 id="settings-data-title" className="dashboard-section-title settings-card-title">Your data</h2>
      <p className="text-muted settings-row-text">
        POPIA gives you the right to see the personal information we hold about you. You can download a copy whenever you like.
      </p>
      <p className="settings-list-title">The file contains</p>
      <ul className="settings-list">
        {INCLUDED_IN_EXPORT.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="settings-field-hint">The file is in JSON format. Any text editor can open it.</p>
      <div className="settings-actions settings-actions-inline">
        <button type="button" className="btn btn-secondary" onClick={handleDownload} disabled={state === "working"}>
          <DownloadIcon />
          {state === "working" ? "Preparing your file..." : "Download my data"}
        </button>
      </div>
      {message && (
        <p className={`settings-note${state === "failed" ? " is-warning" : " is-success"}`} role={state === "failed" ? "alert" : "status"}>
          {message}
        </p>
      )}
    </section>
  );
}