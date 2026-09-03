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

const PRIMARY_COLOURS = [
  {
    src: gridTealSwatch,
    number: 6,
    name: "Grid Teal",
    hex: "#4D869C",
    rgb: "(77, 134, 156)",
    hsl: "(196, 36%, 46%)",
    usage: "Primary brand colour, main actions, headers",
  },
  {
    src: meterMintSwatch,
    number: 7,
    name: "Meter Mint",
    hex: "#7AB2B2",
    rgb: "(122, 178, 178)",
    hsl: "(180, 28%, 59%)",
    usage: "Secondary brand colour",
  },
  {
    src: conductorInkSwatch,
    number: 8,
    name: "Conductor Ink",
    hex: "#0B1120",
    rgb: "(11, 17, 32)",
    hsl: "(226, 49%, 8%)",
    usage: "Dark mode primary",
  },
];

const SUPPORTING_COLOURS = [
  {
    src: daylightSwatch,
    number: 9,
    name: "Daylight",
    hex: "#EEF7FF",
    rgb: "(238, 247, 255)",
    hsl: "(208, 100%, 97%)",
    usage: "Light mode backgrounds",
  },
  {
    src: surfaceFrostSwatch,
    number: 10,
    name: "Surface Frost",
    hex: "#CDE8E5",
    rgb: "(205, 232, 229)",
    hsl: "(173, 34%, 86%)",
    usage: "Cards, surfaces, borders",
  },
  {
    src: nightPrimarySwatch,
    number: 11,
    name: "Night Primary",
    hex: "#8BB8E8",
    rgb: "(139, 184, 232)",
    hsl: "(211, 68%, 73%)",
    usage: "Dark mode accents",
  },
];

const SPACING_TOKENS = [
  ["--space-1", "0.25rem", "Compact spacing"],
  ["--space-2", "0.5rem", "Tight spacing, icons"],
  ["--space-3", "0.75rem", "Small gaps"],
  ["--space-4", "1rem", "Standard spacing"],
  ["--space-5", "1.5rem", "Medium spacing"],
  ["--space-6", "2rem", "Large spacing"],
  ["--space-7", "3rem", "Section spacing"],
  ["--space-8", "4rem", "Page spacing"],
];

const RADIUS_TOKENS = [
  ["--radius-sm", "0.375rem", "Inputs, small buttons"],
  ["--radius-md", "0.625rem", "Cards, modals"],
  ["--radius-lg", "1rem", "Large cards, containers"],
  ["--radius-pill", "62.44rem", "Badges, pills"],
];

function SectionHeader({ number, title }) {
  return (
    <>
      <div
        style={{
          fontSize: "var(--fs-h2)",
          fontWeight: "var(--fw-bold)",
          color: "var(--brand-primary)",
          fontFamily: "var(--font-heading)",
          marginBottom: "var(--space-2)",
        }}
      >
        {number}
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
        {title}
      </h2>
    </>
  );
}

function SubHeading({ children, mt = true }) {
  return (
    <h4
      style={{
        fontSize: "var(--fs-h3)",
        fontWeight: "var(--fw-semibold)",
        fontFamily: "var(--font-heading)",
        color: "var(--brand-ink)",
        marginBottom: "var(--space-2)",
        marginTop: mt ? "var(--space-4)" : 0,
      }}
    >
      {children}
    </h4>
  );
}

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

function TokenCard({ token, value, usage }) {
  return (
    <div
      style={{
        padding: "var(--space-3)",
        backgroundColor: "var(--brand-surface-alt)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--brand-border)",
        color: "var(--brand-ink)",
      }}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)" }}>{token}</div>
      <div style={{ fontSize: "var(--fs-body)", fontFamily: "var(--font-mono)", color: "var(--brand-primary)" }}>{value}</div>
      <div style={{ fontSize: "var(--fs-small)", color: "var(--brand-ink-muted)", fontFamily: "var(--font-body)" }}>{usage}</div>
    </div>
  );
}

function TokenGrid({ tokens }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "var(--space-3)",
        marginBottom: "var(--space-4)",
      }}
    >
      {tokens.map(([tok, val, use]) => (
        <TokenCard key={tok} token={tok} value={val} usage={use} />
      ))}
    </div>
  );
}

function TableHead({ columns }) {
  return (
    <thead>
      <tr style={{ borderBottom: "1px solid var(--brand-border)", textAlign: "left" }}>
        {columns.map((col) => (
          <th
            key={col}
            style={{
              padding: "var(--space-2)",
              fontWeight: "var(--fw-semibold)",
              color: "var(--brand-ink-muted)",
            }}
          >
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function StyledTable({ columns, children }) {
  return (
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
      <TableHead columns={columns} />
      <tbody>{children}</tbody>
    </table>
  );
}

function StyledTd({ mono, children }) {
  return (
    <td
      style={{
        padding: "var(--space-2)",
        fontFamily: mono ? "var(--font-mono)" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function StyledTr({ cells }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--brand-border)" }}>
      {cells.map(({ content, mono }, i) => (
        <StyledTd key={i} mono={mono}>
          {content}
        </StyledTd>
      ))}
    </tr>
  );
}

function BodyText({ children, mb = "var(--space-3)" }) {
  return (
    <p
      style={{
        color: "var(--brand-ink-muted)",
        lineHeight: "var(--lh-body)",
        fontFamily: "var(--font-body)",
        marginBottom: mb,
      }}
    >
      {children}
    </p>
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
              <span>Team Coreflow - COS 301, University of Pretoria</span>
            </div>
          </section>

          <section id="intro" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <SectionHeader number="1" title="Introduction" />

            <SubHeading>1.1 What is OptiGrid?</SubHeading>
            <BodyText>
              OptiGrid ingests meter readings from offices, hospitals, schools, shopping centres,
              and industrial sites, then surfaces what is consuming energy, where it is wasted,
              and what to do about it. Real-time monitoring, anomaly detection, demand
              forecasting, and optimisation recommendations come together in a single
              dashboard-first experience, so operators stop reacting to bills after the fact and
              start making decisions on live data.
            </BodyText>

            <SubHeading>1.2 Our Vision</SubHeading>
            <BodyText>
              Make every buildings energy usage visible, predictable, and improvable - a future
              where operators have the same instrumentation for energy as they do for finance:
              real-time, granular, and acted on daily rather than quarterly.
            </BodyText>

            <SubHeading>1.3 Our Mission</SubHeading>
            <BodyText mb="0">
              Deliver a scalable, multi-tenant platform that ingests data from any meter or feed,
              detects inefficiencies, forecasts demand, and recommends cost-saving actions. Built
              on open standards so any building, large or small, can participate.
            </BodyText>
          </section>

          <section id="logo" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <SectionHeader number="2" title="Logo & Iconography" />

            <SubHeading>2.1 Main Logo</SubHeading>
            <BodyText>
              The wordmark set in Space Grotesk Bold. A dark variant (ink on light surfaces) and
              a light variant (soft primary on dark surfaces) exist - use whichever produces the
              higher contrast against its background.
            </BodyText>
            <Figure src={mainLogo} number={1} caption="OptiGrid Main Logo" maxHeight="140px" />

            <SubHeading>2.2 Secondary Logo</SubHeading>
            <BodyText>
              A square OG monogram with the wordmark stacked below, built for compact
              placements: app icons, favicons, social avatars, and anywhere the horizontal
              wordmark would be illegible.
            </BodyText>
            <Figure src={secondaryLogo} number={2} caption="OptiGrid Secondary Logo" maxHeight="220px" />

            <SubHeading>2.3 Logo Usage Rules</SubHeading>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Minimum size</strong> - full logo: 24px minimum height. Monogram: 32x32px minimum.
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
            <SectionHeader number="3" title="Typography" />

            <SubHeading>3.1.1 Space Grotesk</SubHeading>
            <Figure src={spaceGroteskSpecimen} number={3} caption="Space Grotesk" maxHeight="200px" />
            <p
              style={{
                fontSize: "var(--fs-small)",
                color: "var(--brand-ink-muted)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Usage:</strong> headings, dashboard titles <strong>Source:</strong> Google Fonts <strong>Weights:</strong> 500, 700
            </p>
            <BodyText>
              Used for all headings, dashboard titles, the wordmark, and prominent calls to
              action. Its geometric letterforms and warm, rounded curves communicate a technical
              product without feeling cold or generic.
            </BodyText>

            <SubHeading>3.1.2 Inter</SubHeading>
            <Figure src={interSpecimen} number={4} caption="Inter" maxHeight="200px" />
            <p
              style={{
                fontSize: "var(--fs-small)",
                color: "var(--brand-ink-muted)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Usage:</strong> body text, paragraphs, form labels, button copy, table cells <strong>Source:</strong> Google Fonts <strong>Weights:</strong> 400, 500, 600, 700
            </p>
            <BodyText>
              Inter holds up at 12px and below, which matters for dense dashboards and metric tables.
            </BodyText>

            <SubHeading>3.1.3 JetBrains Mono</SubHeading>
            <Figure src={jetbrainsMonoSpecimen} number={5} caption="JetBrains Mono" maxHeight="200px" />
            <p
              style={{
                fontSize: "var(--fs-small)",
                color: "var(--brand-ink-muted)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Usage:</strong> numeric values, kWh, costs, timestamps <strong>Source:</strong> Google Fonts <strong>Weights:</strong> 400, 500
            </p>
            <BodyText>
              Tabular-nums lining keeps columns aligned in tables.
            </BodyText>

            <SubHeading>3.2 Typographic Scale</SubHeading>
            <StyledTable columns={["Style", "Variable", "Size", "Usage"]}>
              <StyledTr cells={[{ content: "Display" }, { content: "--fs-hero", mono: true }, { content: "3.25rem" }, { content: "Hero titles, landing pages" }]} />
              <StyledTr cells={[{ content: "H1" }, { content: "--fs-h1", mono: true }, { content: "2.25rem" }, { content: "Page titles, section headers" }]} />
              <StyledTr cells={[{ content: "H2" }, { content: "--fs-h2", mono: true }, { content: "1.75rem" }, { content: "Section headings" }]} />
              <StyledTr cells={[{ content: "H3" }, { content: "--fs-h3", mono: true }, { content: "1.125rem" }, { content: "Card headers, subheadings" }]} />
              <StyledTr cells={[{ content: "Body" }, { content: "--fs-body", mono: true }, { content: "1rem" }, { content: "Default body text" }]} />
              <StyledTr cells={[{ content: "Small" }, { content: "--fs-small", mono: true }, { content: "0.8125rem" }, { content: "Labels, captions, metadata" }]} />
            </StyledTable>

            <SubHeading>3.3 Font Weight</SubHeading>
            <StyledTable columns={["Weight", "Value", "Usage"]}>
              <StyledTr cells={[{ content: "Regular" }, { content: "400", mono: true }, { content: "Body text, paragraphs" }]} />
              <StyledTr cells={[{ content: "Medium" }, { content: "500", mono: true }, { content: "Labels, subheadings, emphasis" }]} />
              <StyledTr cells={[{ content: "Semi-bold" }, { content: "600", mono: true }, { content: "Buttons, important text" }]} />
              <StyledTr cells={[{ content: "Bold" }, { content: "700", mono: true }, { content: "Headings, wordmark" }]} />
            </StyledTable>
          </section>

          <section id="color" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <SectionHeader number="4" title="Colour Palette" />

            <SubHeading>4.1 Primary Colours</SubHeading>
            {PRIMARY_COLOURS.map((c) => (
              <ColorRow key={c.number} {...c} maxHeight="160px" />
            ))}

            <SubHeading>4.2 Supporting Colours</SubHeading>
            {SUPPORTING_COLOURS.map((c) => (
              <ColorRow key={c.number} {...c} maxHeight="160px" />
            ))}

            <SubHeading>4.3 Functional Colours</SubHeading>
            <StyledTable columns={["Name", "Hex", "RGB", "Usage"]}>
              <StyledTr cells={[{ content: "Success" }, { content: "#2F7D5D", mono: true }, { content: "(16, 185, 129)", mono: true }, { content: "Positive actions" }]} />
              <StyledTr cells={[{ content: "Warning" }, { content: "#B26B00", mono: true }, { content: "(245, 158, 11)", mono: true }, { content: "Caution, pending actions" }]} />
              <StyledTr cells={[{ content: "Error" }, { content: "#B23B3B", mono: true }, { content: "(239, 68, 68)", mono: true }, { content: "Destructive actions, errors" }]} />
            </StyledTable>
          </section>

          <section id="tokens" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <SectionHeader number="5" title="Design Tokens" />

            <SubHeading>5.1 Spacing Scale</SubHeading>
            <TokenGrid tokens={SPACING_TOKENS} />

            <SubHeading>5.2 Radius Tokens</SubHeading>
            <TokenGrid tokens={RADIUS_TOKENS} />
          </section>

          <section id="components" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <SectionHeader number="6" title="Components" />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-5)",
              }}
            >
              <div>
                <SubHeading mt={false}>6.1 Buttons</SubHeading>
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
                  <li><strong>Default</strong>: base styling</li>
                  <li><strong>Hover</strong>: darker background and overlay</li>
                  <li><strong>Active</strong>: pressed state</li>
                  <li><strong>Disabled</strong>: no hover</li>
                </ul>
              </div>

              <div>
                <SubHeading mt={false}>6.2 Input</SubHeading>
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
                  <li><strong>Default</strong>: border colour</li>
                  <li><strong>Focus</strong>: border colour Grid Teal</li>
                  <li><strong>Error</strong>: border colour Error, error message</li>
                  <li><strong>Success</strong>: border colour Success</li>
                  <li><strong>Disabled</strong>: 50% opacity</li>
                </ul>
              </div>

              <div>
                <SubHeading mt={false}>6.3 Badges</SubHeading>
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
                  <li><strong>Default</strong>: Grid Teal</li>
                  <li><strong>Success</strong>: #2F7D5D</li>
                  <li><strong>Warning</strong>: #B26B00</li>
                  <li><strong>Error</strong>: #B23B3B</li>
                </ul>
              </div>

              <div>
                <SubHeading mt={false}>6.5 Cards</SubHeading>
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
                  <li>Background - white (light mode) or Night Primary (dark mode)</li>
                  <li>Border radius - --radius-md</li>
                  <li>Shadow - --shadow-md</li>
                  <li>Padding - --space-5</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="principles" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <SectionHeader number="7" title="Design Principles" />

            <SubHeading>7.1 Clarity over Decoration</SubHeading>
            <BodyText>
              A user should read the most important number on a screen without scanning. Metrics are large, mono, and unambiguous.
            </BodyText>

            <SubHeading>7.2 Consistency</SubHeading>
            <BodyText>
              A button, badge, or card looks the same on every screen. Tokens, not bespoke styles.
            </BodyText>

            <SubHeading>7.3 Responsive</SubHeading>
            <BodyText>
              Every screen works from 360px upward. The sidebar collapses to a top nav below 768px.
            </BodyText>

            <SubHeading>7.4 Accessible First</SubHeading>
            <BodyText>
              Visible focus rings, labelled inputs, colour never the only signal. WCAG 2.2 AA minimum.
            </BodyText>

            <SubHeading>7.5 Quiet by Default</SubHeading>
            <BodyText>
              No carousels, no parallax, no modal-on-load. Motion limited to 150ms transitions.
            </BodyText>
          </section>

          <section id="a11y" style={{ marginBottom: "var(--space-8)", scrollMarginTop: "var(--space-6)" }}>
            <SectionHeader number="8" title="Accessibility Standards" />
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
            <SectionHeader number="9" title="Voice & Tone" />

            <SubHeading>9.1 Use Active Voice</SubHeading>
            <BodyText>
              Good: Add a new building. Avoid: A new building can be added.
            </BodyText>

            <SubHeading>9.2 UI Copy Guidelines</SubHeading>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Button labels</strong> - use action verbs (Edit, Delete, Register, Compare); be specific (Add Building, not Submit).
            </p>
            <p
              style={{
                color: "var(--brand-ink-muted)",
                lineHeight: "var(--lh-body)",
                fontFamily: "var(--font-body)",
                marginBottom: "var(--space-2)",
              }}
            >
              <strong>Error messages</strong> - explain the problem clearly and provide a solution or next step.
            </p>
            <BodyText>
              <strong>Empty states</strong> - explain what should be there and provide a call to action.
            </BodyText>

            <SubHeading>9.3 Examples</SubHeading>
            <StyledTable columns={["Context", "Preferred copy"]}>
              <StyledTr cells={[{ content: "Empty building list" }, { content: "No buildings yet. Add your first building to start monitoring energy usage." }]} />
              <StyledTr cells={[{ content: "Error saving" }, { content: "Could not save changes. Please check all fields and try again." }]} />
              <StyledTr cells={[{ content: "Success action" }, { content: "Building added successfully." }]} />
              <StyledTr cells={[{ content: "Confirmation" }, { content: "Are you sure you want to delete this building? This action cannot be undone." }]} />
            </StyledTable>
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
            <StyledTable columns={["Version", "Date", "Description", "Author"]}>
              <StyledTr
                cells={[
                  { content: "1.0" },
                  { content: "July 30, 2026" },
                  { content: "Initial release of the OptiGrid Brand Style Guide. Added Accessibility Standards, Voice & Tone, and Design Tokens." },
                  { content: "Team Coreflow" },
                ]}
              />
            </StyledTable>
          </section>
        </main>
      </div>
    </div>
  );
}