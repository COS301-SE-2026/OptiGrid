"use client";

import React, { useState } from "react";
import Image from "next/image";

import mainLogo from "./mainlogo.png";
import secondaryLogo from "./secondarylogo.png";
import spaceGroteskSpecimen from "./spacegrotesk.png";
import interSpecimen from "./inter.png";
import jetbrainsMonoSpecimen from "./jetbrainsmono.png";
import gridTealSwatch from "./gridteal.png";
import meterMintSwatch from "./metermint.png";
import conductorInkSwatch from "./conductorink.png";
import daylightSwatch from "./daylight.png";
import surfaceFrostSwatch from "./surfacefrost.png";
import nightPrimarySwatch from "./nightprimary.png";
import buttonsFigure from "./buttons.png";
import inputFigure from "./inputfield.png";
import badgesFigure from "./badges.png";
import cardFigure from "./card.png";

const NAV = [
  { id: "intro", label: "Introduction" },
  { id: "logo", label: "Logo & Iconography" },
  { id: "type", label: "Typography" },
  { id: "color", label: "Colour Palette" },
  { id: "tokens", label: "Design Tokens" },
  { id: "components", label: "Components" },
  { id: "principles", label: "Design Principles" },
  { id: "a11y", label: "Accessibility" },
  { id: "voice", label: "Voice & Tone" },
  { id: "changelog", label: "Changelog" },
];

function Figure({ src, number, caption, maxHeight = "300px" }) {
  const isStatic = typeof src === "object" && src !== null;

  return (
    <figure style={{ marginBottom: "var(--space-5)" }}>
      {src ? (
        <div
          style={{
            height: maxHeight,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            
          }}
        >
          <Image
            src={src}
            alt={caption}
            {...(!isStatic ? { width: 800, height: 400 } : {})}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            height: maxHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--brand-surface-alt)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--brand-border)",
            color: "var(--brand-ink-muted)",
            fontSize: "var(--fs-small)",
            fontFamily: "var(--font-body)",
          }}
        >
          No image imported
        </div>
      )}
      <figcaption
        style={{
          marginTop: "var(--space-2)",
          fontSize: "var(--fs-small)",
          color: "var(--brand-ink-muted)",
          fontFamily: "var(--font-body)",
          textAlign: "center",
        }}
      >
        Figure {number}: {caption}
      </figcaption>
    </figure>
  );
}

function ColorRow({ src, number, name, hex, rgb, hsl, usage, maxHeight = "180px" }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "var(--space-4)",
        marginBottom: "var(--space-5)",
        alignItems: "start",
      }}
    >
      <Figure src={src} number={number} caption={name} maxHeight={maxHeight} />
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "var(--space-1) var(--space-3)",
          fontSize: "var(--fs-small)",
          fontFamily: "var(--font-body)",
          margin: 0,
          color: "var(--brand-ink)",
        }}
      >
        <dt style={{ fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Name</dt>
        <dd style={{ margin: 0 }}>{name}</dd>
        <dt style={{ fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Hex</dt>
        <dd style={{ margin: 0, fontFamily: "var(--font-mono)" }}>{hex}</dd>
        <dt style={{ fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>RGB</dt>
        <dd style={{ margin: 0, fontFamily: "var(--font-mono)" }}>{rgb}</dd>
        <dt style={{ fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>HSL</dt>
        <dd style={{ margin: 0, fontFamily: "var(--font-mono)" }}>{hsl}</dd>
        <dt style={{ fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Usage</dt>
        <dd style={{ margin: 0 }}>{usage}</dd>
      </dl>
    </div>
  );
}

export default function OptiGridStyleGuide() {
  const [navOpen, setNavOpen] = useState(false);

  const scrollTo = (id) => {
    setNavOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      style={{
        backgroundColor: "var(--brand-bg)",
        color: "var(--brand-ink)",
        minHeight: "100vh",
        fontFamily: "var(--font-body)",
      }}
    >
      <div
        style={{
          display: "flex",
          maxWidth: "1200px",
          margin: "0 auto",
          minHeight: "100vh",
        }}
      >
        <aside
          style={{
            width: "280px",
            padding: "var(--space-6)",
            backgroundColor: "var(--brand-surface)",
            borderRight: "1px solid var(--brand-border)",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--fw-bold)",
                fontSize: "1.5rem",
                color: "var(--brand-ink)",
              }}
            >
              Opti<span style={{ color: "var(--brand-primary)" }}>Grid</span>
            </div>
            <div
              style={{
                fontSize: "var(--fs-small)",
                color: "var(--brand-ink-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              Brand Style Guide
            </div>
          </div>

          <nav
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-1)",
            }}
          >
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                style={{
                  textAlign: "left",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: "var(--brand-ink-muted)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--fs-body)",
                  fontWeight: "var(--fw-medium)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--brand-surface-alt)";
                  e.currentTarget.style.color = "var(--brand-ink)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--brand-ink-muted)";
                }}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </aside>

        <main
          style={{
            flex: 1,
            padding: "var(--space-8)",
            maxWidth: "900px",
            backgroundColor: "var(--brand-surface)",
          }}
        >
          <section style={{ marginBottom: "var(--space-8)" }}>
            <div
              style={{
                fontSize: "var(--fs-hero)",
                fontFamily: "var(--font-heading)",
                fontWeight: "var(--fw-bold)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-4)",
              }}
            >
              OptiGrid Brand Guide
            </div>
            <p
              style={{
                fontSize: "1.125rem",
                color: "var(--brand-ink-muted)",
                maxWidth: "600px",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-4)",
              }}
            >
              OptiGrid is a centralised energy intelligence platform for the built environment.
              This guide is the single source of truth for how the brand looks, sounds, and
              behaves across every surface.
            </p>
            <div
              style={{
                display: "flex",
                gap: "var(--space-4)",
                fontSize: "var(--fs-small)",
                color: "var(--brand-ink-muted)",
                fontFamily: "var(--font-body)",
                flexWrap: "wrap",
              }}
            >
              <span>Version 1.0</span>
              <span>July 30, 2026</span>
              <span>Team Coreflow · COS 301, University of Pretoria</span>
            </div>
          </section>

          <section id="intro" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <div
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-heading)",
                marginBottom: "var(--space-2)",
              }}
            >
              1
            </div>
            <h2
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-4)",
              }}
            >
              Introduction
            </h2>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              1.1 What is OptiGrid?
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              OptiGrid ingests meter readings from offices, hospitals, schools, shopping centres,
              and industrial sites, then surfaces what is consuming energy, where it is wasted,
              and what to do about it. Real-time monitoring, anomaly detection, demand
              forecasting, and optimisation recommendations come together in a single
              dashboard-first experience, so operators stop reacting to bills after the fact and
              start making decisions on live data.
            </p>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              1.2 Our Vision
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              Make every building's energy usage visible, predictable, and improvable — a future
              where operators have the same instrumentation for energy as they do for finance:
              real-time, granular, and acted on daily rather than quarterly.
            </p>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              1.3 Our Mission
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
              }}
            >
              Deliver a scalable, multi-tenant platform that ingests data from any meter or feed,
              detects inefficiencies, forecasts demand, and recommends cost-saving actions. Built
              on open standards so any building, large or small, can participate.
            </p>
          </section>

          <section id="logo" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <div
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-heading)",
                marginBottom: "var(--space-2)",
              }}
            >
              2
            </div>
            <h2
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-4)",
              }}
            >
              Logo & Iconography
            </h2>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              2.1 Main Logo
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              The wordmark set in Space Grotesk Bold. A dark variant (ink on light surfaces) and
              a light variant (soft primary on dark surfaces) exist — use whichever produces the
              higher contrast against its background.
            </p>
            <Figure src={mainLogo} number={1} caption="OptiGrid Main Logo" maxHeight="140px" />

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              2.2 Secondary Logo
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              A square "OG" monogram with the wordmark stacked below, built for compact
              placements: app icons, favicons, social avatars, and anywhere the horizontal
              wordmark would be illegible.
            </p>
            <Figure src={secondaryLogo} number={2} caption="OptiGrid Secondary Logo" maxHeight="220px" />

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              2.3 Logo Usage Rules
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Minimum size</strong> — full logo: 24px minimum height. Monogram: 32x32px minimum.
            </p>
            <ul
              style={{
                paddingLeft: "var(--space-5)",
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                margin: 0,
              }}
            >
              <li>Never stretch or distort the logo</li>
              <li>Never recolour it outside the approved variants</li>
              <li>Never place it on a low-contrast background</li>
              <li>Never rotate it</li>
            </ul>
          </section>

          <section id="type" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <div
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-heading)",
                marginBottom: "var(--space-2)",
              }}
            >
              3
            </div>
            <h2
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-4)",
              }}
            >
              Typography
            </h2>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              3.1.1 Space Grotesk
            </h4>
            <Figure src={spaceGroteskSpecimen} number={3} caption="Space Grotesk" maxHeight="200px" />
            <p
              style={{
                fontSize: "var(--fs-small)",
                color: "var(--brand-ink-muted)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Usage:</strong> headings, dashboard titles  <strong>Source:</strong> Google Fonts
               <strong>Weights:</strong> 500, 700
            </p>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              Used for all headings, dashboard titles, the wordmark, and prominent calls to
              action. Its geometric letterforms and warm, rounded curves communicate a technical
              product without feeling cold or generic.
            </p>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              3.1.2 Inter
            </h4>
            <Figure src={interSpecimen} number={4} caption="Inter" maxHeight="200px" />
            <p
              style={{
                fontSize: "var(--fs-small)",
                color: "var(--brand-ink-muted)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Usage:</strong> body text, paragraphs, form labels, button copy, table cells
               <strong>Source:</strong> Google Fonts  <strong>Weights:</strong> 400, 500, 600, 700
            </p>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              Inter holds up at 12px and below, which matters for dense dashboards and metric tables.
            </p>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              3.1.3 JetBrains Mono
            </h4>
            <Figure src={jetbrainsMonoSpecimen} number={5} caption="JetBrains Mono" maxHeight="200px" />
            <p
              style={{
                fontSize: "var(--fs-small)",
                color: "var(--brand-ink-muted)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Usage:</strong> numeric values, kWh, costs, timestamps 
              <strong> Source:</strong> Google Fonts  <strong>Weights:</strong> 400, 500
            </p>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              Tabular-nums lining keeps columns aligned in tables.
            </p>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              3.2 Typographic Scale
            </h4>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-body)",
                fontSize: "var(--fs-small)",
                marginBottom: "var(--space-4)",
                color: "var(--brand-ink)",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--brand-border)",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Style</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Variable</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Size</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Usage</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Display</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>--fs-hero</td>
                  <td style={{ padding: "var(--space-2)" }}>3.25rem</td>
                  <td style={{ padding: "var(--space-2)" }}>Hero titles, landing pages</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>H1</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>--fs-h1</td>
                  <td style={{ padding: "var(--space-2)" }}>2.25rem</td>
                  <td style={{ padding: "var(--space-2)" }}>Page titles, section headers</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>H2</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>--fs-h2</td>
                  <td style={{ padding: "var(--space-2)" }}>1.75rem</td>
                  <td style={{ padding: "var(--space-2)" }}>Section headings</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>H3</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>--fs-h3</td>
                  <td style={{ padding: "var(--space-2)" }}>1.125rem</td>
                  <td style={{ padding: "var(--space-2)" }}>Card headers, subheadings</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Body</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>--fs-body</td>
                  <td style={{ padding: "var(--space-2)" }}>1rem</td>
                  <td style={{ padding: "var(--space-2)" }}>Default body text</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Small</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>--fs-small</td>
                  <td style={{ padding: "var(--space-2)" }}>0.8125rem</td>
                  <td style={{ padding: "var(--space-2)" }}>Labels, captions, metadata</td>
                </tr>
              </tbody>
            </table>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              3.3 Font Weight
            </h4>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-body)",
                fontSize: "var(--fs-small)",
                marginBottom: "var(--space-4)",
                color: "var(--brand-ink)",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--brand-border)", textAlign: "left" }}>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Weight</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Value</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Usage</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Regular</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>400</td>
                  <td style={{ padding: "var(--space-2)" }}>Body text, paragraphs</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Medium</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>500</td>
                  <td style={{ padding: "var(--space-2)" }}>Labels, subheadings, emphasis</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Semi-bold</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>600</td>
                  <td style={{ padding: "var(--space-2)" }}>Buttons, important text</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Bold</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>700</td>
                  <td style={{ padding: "var(--space-2)" }}>Headings, wordmark</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section id="color" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <div
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-heading)",
                marginBottom: "var(--space-2)",
              }}
            >
              4
            </div>
            <h2
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-4)",
              }}
            >
              Colour Palette
            </h2>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              4.1 Primary Colours
            </h4>
            <ColorRow src={gridTealSwatch} number={6} name="Grid Teal" hex="#4D869C" rgb="(77, 134, 156)" hsl="(196°, 36%, 46%)" usage="Primary brand colour, main actions, headers" maxHeight="160px" />
            <ColorRow src={meterMintSwatch} number={7} name="Meter Mint" hex="#7AB2B2" rgb="(122, 178, 178)" hsl="(180°, 28%, 59%)" usage="Secondary brand colour" maxHeight="160px" />
            <ColorRow src={conductorInkSwatch} number={8} name="Conductor Ink" hex="#0B1120" rgb="(11, 17, 32)" hsl="(226°, 49%, 8%)" usage="Dark mode primary" maxHeight="160px" />

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              4.2 Supporting Colours
            </h4>
            <ColorRow src={daylightSwatch} number={9} name="Daylight" hex="#EEF7FF" rgb="(238, 247, 255)" hsl="(208°, 100%, 97%)" usage="Light mode backgrounds" maxHeight="160px" />
            <ColorRow src={surfaceFrostSwatch} number={10} name="Surface Frost" hex="#CDE8E5" rgb="(205, 232, 229)" hsl="(173°, 34%, 86%)" usage="Cards, surfaces, borders" maxHeight="160px" />
            <ColorRow src={nightPrimarySwatch} number={11} name="Night Primary" hex="#8BB8E8" rgb="(139, 184, 232)" hsl="(211°, 68%, 73%)" usage="Dark mode accents" maxHeight="160px" />

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              4.3 Functional Colours
            </h4>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-body)",
                fontSize: "var(--fs-small)",
                marginBottom: "var(--space-4)",
                color: "var(--brand-ink)",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--brand-border)", textAlign: "left" }}>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Name</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Hex</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>RGB</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Usage</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Success</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>#2F7D5D</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>(16, 185, 129)</td>
                  <td style={{ padding: "var(--space-2)" }}>Positive actions</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Warning</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>#B26B00</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>(245, 158, 11)</td>
                  <td style={{ padding: "var(--space-2)" }}>Caution, pending actions</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Error</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>#B23B3B</td>
                  <td style={{ padding: "var(--space-2)", fontFamily: "var(--font-mono)" }}>(239, 68, 68)</td>
                  <td style={{ padding: "var(--space-2)" }}>Destructive actions, errors</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section id="tokens" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <div
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-heading)",
                marginBottom: "var(--space-2)",
              }}
            >
              5
            </div>
            <h2
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-4)",
              }}
            >
              Design Tokens
            </h2>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              5.1 Spacing Scale
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "var(--space-3)",
                marginBottom: "var(--space-4)",
              }}
            >
              {[
                ["--space-1", "0.25rem", "Compact spacing"],
                ["--space-2", "0.5rem", "Tight spacing, icons"],
                ["--space-3", "0.75rem", "Small gaps"],
                ["--space-4", "1rem", "Standard spacing"],
                ["--space-5", "1.5rem", "Medium spacing"],
                ["--space-6", "2rem", "Large spacing"],
                ["--space-7", "3rem", "Section spacing"],
                ["--space-8", "4rem", "Page spacing"],
              ].map(([tok, val, use]) => (
                <div
                  key={tok}
                  style={{
                    padding: "var(--space-3)",
                    backgroundColor: "var(--brand-surface-alt)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--brand-border)",
                    color: "var(--brand-ink)",
                  }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)" }}>{tok}</div>
                  <div style={{ fontSize: "var(--fs-body)", fontFamily: "var(--font-mono)", color: "var(--brand-primary)" }}>{val}</div>
                  <div style={{ fontSize: "var(--fs-small)", color: "var(--brand-ink-muted)", fontFamily: "var(--font-body)" }}>{use}</div>
                </div>
              ))}
            </div>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              5.2 Radius Tokens
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "var(--space-3)",
                marginBottom: "var(--space-4)",
              }}
            >
              {[
                ["--radius-sm", "0.375rem", "Inputs, small buttons"],
                ["--radius-md", "0.625rem", "Cards, modals"],
                ["--radius-lg", "1rem", "Large cards, containers"],
                ["--radius-pill", "62.44rem", "Badges, pills"],
              ].map(([tok, val, use]) => (
                <div
                  key={tok}
                  style={{
                    padding: "var(--space-3)",
                    backgroundColor: "var(--brand-surface-alt)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--brand-border)",
                    color: "var(--brand-ink)",
                  }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)" }}>{tok}</div>
                  <div style={{ fontSize: "var(--fs-body)", fontFamily: "var(--font-mono)", color: "var(--brand-primary)" }}>{val}</div>
                  <div style={{ fontSize: "var(--fs-small)", color: "var(--brand-ink-muted)", fontFamily: "var(--font-body)" }}>{use}</div>
                </div>
              ))}
            </div>
          </section>

          <section id="components" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <div
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-heading)",
                marginBottom: "var(--space-2)",
              }}
            >
              6
            </div>
            <h2
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-4)",
              }}
            >
              Components
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-5)",
              }}
            >
              <div>
                <h4
                  style={{
                    fontSize: "var(--fs-h3)",
                    fontWeight: "var(--fw-semibold)",
                    fontFamily: "var(--font-heading)",
                    color: "var(--brand-ink)",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  6.1 Buttons
                </h4>
                <Figure src={buttonsFigure} number={12} caption="Buttons" maxHeight="140px" />
                <ul
                  style={{
                    paddingLeft: "var(--space-5)",
                    color: "var(--brand-ink-muted)",
                    lineHeight: "var(--lh-body)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--fs-small)",
                    margin: 0,
                  }}
                >
                  <li><strong>Default</strong> : base styling</li>
                  <li><strong>Hover</strong> : darker background and overlay</li>
                  <li><strong>Active</strong> : pressed state</li>
                  <li><strong>Disabled</strong> : no hover</li>
                </ul>
              </div>

              <div>
                <h4
                  style={{
                    fontSize: "var(--fs-h3)",
                    fontWeight: "var(--fw-semibold)",
                    fontFamily: "var(--font-heading)",
                    color: "var(--brand-ink)",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  6.2 Input
                </h4>
                <Figure src={inputFigure} number={13} caption="Input Field" maxHeight="220px" />
                <ul
                  style={{
                    paddingLeft: "var(--space-5)",
                    color: "var(--brand-ink-muted)",
                    lineHeight: "var(--lh-body)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--fs-small)",
                    margin: 0,
                  }}
                >
                  <li><strong>Default</strong> : border colour</li>
                  <li><strong>Focus</strong> : border colour Grid Teal</li>
                  <li><strong>Error</strong> : border colour Error, error message</li>
                  <li><strong>Success</strong> : border colour Success</li>
                  <li><strong>Disabled</strong> : 50% opacity</li>
                </ul>
              </div>

              <div>
                <h4
                  style={{
                    fontSize: "var(--fs-h3)",
                    fontWeight: "var(--fw-semibold)",
                    fontFamily: "var(--font-heading)",
                    color: "var(--brand-ink)",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  6.3 Badges
                </h4>
                <Figure src={badgesFigure} number={14} caption="Badges" maxHeight="100px" />
                <ul
                  style={{
                    paddingLeft: "var(--space-5)",
                    color: "var(--brand-ink-muted)",
                    lineHeight: "var(--lh-body)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--fs-small)",
                    margin: 0,
                  }}
                >
                  <li><strong>Default</strong> : Grid Teal</li>
                  <li><strong>Success</strong> : #2F7D5D</li>
                  <li><strong>Warning</strong> : #B26B00</li>
                  <li><strong>Error</strong> : #B23B3B</li>
                </ul>
              </div>

              <div>
                <h4
                  style={{
                    fontSize: "var(--fs-h3)",
                    fontWeight: "var(--fw-semibold)",
                    fontFamily: "var(--font-heading)",
                    color: "var(--brand-ink)",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  6.5 Cards
                </h4>
                <Figure src={cardFigure} number={15} caption="Card Component" maxHeight="260px" />
                <ul
                  style={{
                    paddingLeft: "var(--space-5)",
                    color: "var(--brand-ink-muted)",
                    lineHeight: "var(--lh-body)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--fs-small)",
                    margin: 0,
                  }}
                >
                  <li>Background — white (light mode) or Night Primary (dark mode)</li>
                  <li>Border radius — --radius-md</li>
                  <li>Shadow — --shadow-md</li>
                  <li>Padding — --space-5</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="principles" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <div
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-heading)",
                marginBottom: "var(--space-2)",
              }}
            >
              7
            </div>
            <h2
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-4)",
              }}
            >
              Design Principles
            </h2>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              7.1 Clarity over Decoration
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              A user should read the most important number on a screen without scanning. Metrics are large, mono, and unambiguous.
            </p>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              7.2 Consistency
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              A button, badge, or card looks the same on every screen. Tokens, not bespoke styles.
            </p>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              7.3 Responsive
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              Every screen works from 360px upward. The sidebar collapses to a top nav below 768px.
            </p>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              7.4 Accessible First
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              Visible focus rings, labelled inputs, colour never the only signal. WCAG 2.2 AA minimum.
            </p>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              7.5 Quiet by Default
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              No carousels, no parallax, no modal-on-load. Motion limited to 150ms transitions.
            </p>
          </section>

          <section id="a11y" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <div
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-heading)",
                marginBottom: "var(--space-2)",
              }}
            >
              8
            </div>
            <h2
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-4)",
              }}
            >
              Accessibility Standards
            </h2>
            <ul
              style={{
                paddingLeft: "var(--space-5)",
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                margin: 0,
              }}
            >
              <li>OptiGrid targets WCAG 2.2 AA as the minimum compliance level; AAA is encouraged for body text where possible.</li>
              <li>All interactive elements are keyboard accessible.</li>
              <li>Form inputs have associated labels.</li>
              <li>The colour palette was chosen specifically to ensure accessibility.</li>
            </ul>
          </section>

          <section id="voice" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <div
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-heading)",
                marginBottom: "var(--space-2)",
              }}
            >
              9
            </div>
            <h2
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-4)",
              }}
            >
              Voice & Tone
            </h2>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              9.1 Use Active Voice
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              Good: "Add a new building."  Avoid: "A new building can be added."
            </p>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              9.2 UI Copy Guidelines
            </h4>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Button labels</strong> — use action verbs ("Edit", "Delete", "Register", "Compare"); be specific ("Add Building", not "Submit").
            </p>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Error messages</strong> — explain the problem clearly and provide a solution or next step.
            </p>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-3)",
              }}
            >
              <strong>Empty states</strong> — explain what should be there and provide a call to action.
            </p>

            <h4
              style={{
                fontSize: "var(--fs-h3)",
                fontWeight: "var(--fw-semibold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-2)",
                marginTop: "var(--space-4)",
              }}
            >
              9.3 Examples
            </h4>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-body)",
                fontSize: "var(--fs-small)",
                marginBottom: "var(--space-4)",
                color: "var(--brand-ink)",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--brand-border)", textAlign: "left" }}>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Context</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Preferred copy</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Empty building list</td>
                  <td style={{ padding: "var(--space-2)" }}>"No buildings yet. Add your first building to start monitoring energy usage."</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Error saving</td>
                  <td style={{ padding: "var(--space-2)" }}>"Could not save changes. Please check all fields and try again."</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Success action</td>
                  <td style={{ padding: "var(--space-2)" }}>"Building added successfully."</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>Confirmation</td>
                  <td style={{ padding: "var(--space-2)" }}>"Are you sure you want to delete this building? This action cannot be undone."</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section id="changelog" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <div
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-heading)",
                marginBottom: "var(--space-2)",
              }}
            >
              Revision history
            </div>
            <h2
              style={{
                fontSize: "var(--fs-h2)",
                fontWeight: "var(--fw-bold)",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-ink)",
                marginBottom: "var(--space-4)",
              }}
            >
              Changelog
            </h2>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-body)",
                fontSize: "var(--fs-small)",
                color: "var(--brand-ink)",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--brand-border)", textAlign: "left" }}>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Version</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Date</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Description</th>
                  <th style={{ padding: "var(--space-2)", fontWeight: "var(--fw-semibold)", color: "var(--brand-ink-muted)" }}>Author</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
                  <td style={{ padding: "var(--space-2)" }}>1.0</td>
                  <td style={{ padding: "var(--space-2)" }}>July 30, 2026</td>
                  <td style={{ padding: "var(--space-2)" }}>Initial release of the OptiGrid Brand Style Guide. Added Accessibility Standards, Voice & Tone, and Design Tokens.</td>
                  <td style={{ padding: "var(--space-2)" }}>Team Coreflow</td>
                </tr>
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </div>
  );
}