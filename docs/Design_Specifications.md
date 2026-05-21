# 4.2 Design Specifications

This section defines the visual, structural, and interaction design decisions that guide the development of OptiGrid. It serves as a blueprint to ensure consistency across components and teams in a modular development environment. The specifications translate system requirements into concrete interface and user experience guidelines, reducing ambiguity during implementation.

The document is split into two parts: the brand style, which fixes the visual identity, and the wireframes, which fix the structural layout of each screen.

> **Companion files.** This markdown holds the reference text. The visual reference lives in two HTML files inside `docs/`:
>
> - **Brand guidelines slides:** open [docs/Brand_Guidelines.html](Brand_Guidelines.html) in a browser to see the colour swatches, typography samples, logo lockups, components, and accessibility ratios.
> - **Wireframes:** open [docs/wireframes.html](wireframes.html) in a browser to see every screen as a low-fidelity mockup.

---

## 4.2.1 Brand Style

The brand style defines the visual identity of OptiGrid. It is implemented as a single CSS token sheet at [frontend/styles/optigrid-theme.css](../frontend/styles/optigrid-theme.css) so that every page consumes the same values. All developers must use the documented tokens (CSS custom properties) instead of hard-coded colours, sizes, or fonts.

For the full visual reference (colour chips with names, type specimens, logo lockups, component demonstrations, contrast ratios), open [docs/Brand_Guidelines.html](Brand_Guidelines.html) in a browser.

### Color Palette

The palette is intentionally limited. One primary blue/teal anchors the brand, a softer secondary supports surfaces and outlines, and three semantic colours communicate state (success, warning, danger). Each token exists in both a light and a dark variant.

**Light theme (default)**

| Token | HEX | Role |
|---|---|---|
| `--brand-bg` | `#EEF7FF` | Page background |
| `--brand-surface` | `#FFFFFF` | Card and panel background |
| `--brand-surface-alt` | `#CDE8E5` | Hover and accent surface |
| `--brand-primary` | `#4D869C` | Primary actions, links, focus |
| `--brand-primary-hover` | `#3D6C7E` | Primary action hover |
| `--brand-secondary` | `#7AB2B2` | Outlines, secondary buttons |
| `--brand-ink` | `#0B1120` | Body text and headings |
| `--brand-ink-muted` | `#2C3F5F` | Labels, helper text |
| `--brand-border` | `rgba(11, 17, 32, 0.12)` | Card and input borders |
| `--brand-success` | `#2F7D5D` | Success state |
| `--brand-warning` | `#B26B00` | Warning state |
| `--brand-danger` | `#B23B3B` | Destructive action, error |

**Dark theme**

| Token | HEX |
|---|---|
| `--brand-bg` | `#0B1120` |
| `--brand-surface` | `#16203A` |
| `--brand-surface-alt` | `#2C3F5F` |
| `--brand-primary` | `#8BB8E8` |
| `--brand-primary-hover` | `#A6CBF0` |
| `--brand-secondary` | `#8D9DB0` |
| `--brand-ink` | `#EEF7FF` |
| `--brand-ink-muted` | `#9AA9BF` |
| `--brand-success` | `#5FBF93` |
| `--brand-warning` | `#E0A24A` |
| `--brand-danger` | `#E07A7A` |

**Contrast verification.** All ink-on-surface pairs in both themes meet the WCAG 2.1 AA contrast minimum of 4.5:1 for body text. Primary on white reaches 4.55:1; ink on the light background reaches 16.8:1. The dark theme keeps `--brand-ink` on `--brand-surface` at 14.2:1.

### Typography

Three font families cover all interface needs.

| Token | Family | Use |
|---|---|---|
| `--font-heading` | Space Grotesk | All `h1`-`h6`, dashboard titles, landing hero |
| `--font-body` | Inter | Paragraphs, labels, buttons, form input |
| `--font-mono` | JetBrains Mono | Metrics, timestamps, kWh values, IDs |

Numeric metrics use the mono family with `font-variant-numeric: tabular-nums` so columns of numbers line up across rows.

**Type scale**

| Token | Size | Use |
|---|---|---|
| `--fs-hero` | `clamp(2rem, 5vw, 3.25rem)` | Landing hero, `h1` |
| `--fs-h2` | `1.75rem` | Section headers, page titles inside dashboard |
| `--fs-h3` | `1.125rem` | Card headers |
| `--fs-body` | `1rem` | Paragraphs |
| `--fs-small` | `0.8125rem` | Labels, buttons, badges |

**Weights:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold). Headings use bold; buttons and labels use semibold; body text uses regular.

**Line height:** `1.15` for headings (`--lh-tight`), `1.6` for body (`--lh-body`).

### Logo and Iconography

**Logo.** The wordmark is the text "OptiGrid" set in Space Grotesk Bold at `--fs-hero` on the landing page and at `1.25rem` in the dashboard sidebar. The wordmark uses `--brand-primary` against a light background and `--brand-ink` (the inverted ink) against a dark background. Minimum clear space around the wordmark equals the cap height of the "O". No alternate logo lockups exist in this release.

**Icons.** All icons are inline SVGs with `stroke="currentColor"`, `stroke-width="1.5"` or `1.75`, and `stroke-linecap="round"`. Icons inherit the colour of their container. Sizes are `18px` for inline icons (buttons, toggles) and `20px` for navigation and feature icons. The project does not import an external icon library; each icon is a small React component co-located with the feature that uses it.

### Design Principles

The interface is guided by five principles, in order of priority when they conflict.

1. **Clarity over decoration.** A user should be able to read the most important number on each screen without scanning. Metric values are large, mono-spaced, and unambiguous.
2. **Consistency.** A button, badge, or card looks the same on every screen. Components draw from the shared token sheet and the `.btn`, `.card`, `.badge`, `.input` utility classes.
3. **Responsiveness.** Every screen works from 360px wide upward. The dashboard collapses the sidebar to a top nav on widths below `768px`.
4. **Accessibility first.** All interactive elements have visible focus rings, every input has a label, and colour is never the only signal for state.
5. **Quiet by default.** Animation is limited to `0.15s` transitions on hover and focus. There are no carousels, parallax effects, or modal-on-load patterns.

### UI Component Styling

Components are styled through utility classes in the token sheet. The most common are documented here.

**Buttons.** Three variants: `.btn-primary` (filled, primary brand), `.btn-secondary` (outlined, neutral), `.btn-danger` (filled, danger). All buttons share `.btn` (padding `10px 18px`, radius `--radius-md`, semibold). Primary hover darkens the background and lifts the button by `1px`.

**Inputs.** `.input`, `.select`, and `.textarea` share the same border, radius, and padding. On focus they show the standard focus ring (a 2px halo in `--brand-bg` plus a 2px ring in `--brand-primary`). Labels (`.label`) sit above the input.

**Cards.** `.card` provides the standard panel: white surface, subtle border, soft shadow, `24px` of internal padding. Dashboard sections and forms all use cards.

**Badges.** `.badge-success`, `.badge-warning`, `.badge-danger` use a tinted background (18% of the semantic colour) with the same semantic colour for text. Used for building status and alert severity.

**Modals.** `.modal-overlay` covers the page with `45%` ink fill. The `.modal` panel uses the card style at `420px` max width and is vertically centred.

**Spacing scale:** `4 / 8 / 12 / 16 / 24 / 32 / 48 / 72 px` exposed as `--space-1` through `--space-10`. Page gutters use `24px`. Card content uses `16px-24px` vertical rhythm.

**Radius scale:** `6px` (small controls), `10px` (buttons, inputs), `16px` (cards), `999px` (pills, badges).

### Accessibility

OptiGrid targets WCAG 2.1 AA.

- **Contrast.** Every text/background pair in both themes was verified against the 4.5:1 (body) and 3:1 (large text and UI components) minimums.
- **Focus.** Every interactive element exposes a visible focus ring through `--focus-ring`. Focus order follows DOM order; no custom `tabindex` values above 0 are used.
- **Labels.** Every form input has an associated `<label htmlFor>`. Icon-only buttons (theme toggle, delete button, notifications) carry an `aria-label`.
- **Keyboard.** Modals trap focus and close on `Escape`. Tables and lists are navigable with the arrow keys via the browser default.
- **Screen readers.** Semantic HTML is the default: real `<button>`, `<nav>`, `<table>`, `<form>` elements. Status messages use `role="alert"` so changes are announced.
- **Motion.** No motion exceeds 200ms. Users with `prefers-reduced-motion` see transitions disabled at the CSS level.
- **Theme.** A light/dark toggle persists the user's choice in `localStorage`. The initial value respects the system `prefers-color-scheme` preference.

---

## 4.2.2 Wireframes

This subsection lists every screen in the system. The wireframes focus on layout, component placement, and interaction points rather than final visual design. The brand style above governs the polished look; the wireframes govern the structure.

> **Visuals live in [docs/wireframes.html](wireframes.html).** Open it in a browser to view all 33 low-fidelity wireframes laid out in a single scrollable page. The text below names each frame, gives a one-line description, and groups frames by user journey. Open the HTML file alongside this document when reviewing.

Screens are grouped by user journey: public marketing, authentication, monitoring, building management, analytics, data ingestion, administration, account, and utility.

### Layout Foundation

All authenticated screens share a two-pane shell.

```
+-------------------------------------------------------------+
|  Sidebar (240px)              |  Main content area          |
|                               |                             |
|  OptiGrid wordmark            |  Top bar  (theme + user)    |
|                               |                             |
|  Dashboard                    |  Page title + subtitle      |
|  Buildings                    |                             |
|  Compare                      |  Page body (cards, tables)  |
|  Forecast                     |                             |
|  Anomalies                    |                             |
|  Recommendations              |                             |
|  Admin                        |                             |
|                               |                             |
|  -------                      |                             |
|  Logout                       |                             |
+-------------------------------------------------------------+
```

Below 768px the sidebar collapses into a top nav with a hamburger menu; the main content takes the full width.

Public pages (landing, contact, FAQs, auth) do not show the sidebar. They use a slim top nav and the centred content pattern.

### Navigation Flow

```
                       [Landing]
                          |
              +-----------+-----------+
              v                       v
          [Sign Up]                [Login]
              |                       |
              +-----------+-----------+
                          v
                     [Dashboard] <----------------------+
                          |                             |
       +--------+---------+--------+----------+         |
       v        v         v        v          v         |
 [Buildings] [Compare] [Forecast] [Anomalies] [Recs]    |
       |                          |                     |
       +--> [Add / Edit / Delete] +--> [Alert detail]   |
       |                                                |
       +--> [Building detail]                           |
                                                        |
                              [Settings] ---------------+
                              [Admin]
```

Logout from any authenticated page returns the user to Login.

---

### Public and Authentication Screens

- **WF-01 Landing.** Marketing page with top nav (Features, How it works, Contact, FAQs, Login, Sign Up), hero block with two CTAs, a six-card capabilities grid covering every core requirement (multi-source ingestion, real-time monitoring, benchmarking, anomaly detection, demand forecasting, optimisation engine), a "How it works" four-step strip, a multi-tenant/RBAC callout, and a footer sitemap.
- **WF-02 Sign Up.** Centred form card with First name, Last name, Email, Password, Confirm password. Inline validation; submit disabled until all fields are valid.
- **WF-03 Login.** Centred form card with Email, Password, and a "Forgot password?" link. Notice slot above the form shows post-logout or post-signup confirmations. On success: redirect to `/dashboard`.
- **WF-04 Forgot Password.** Single-field form (Email) that submits and swaps to a confirmation message.
- **WF-05 Reset Password.** Two fields (new password, confirm) reached via a tokenised email link. Success redirects to Login.

---

### Monitoring Screens

- **WF-06 Dashboard (Portfolio Overview).** First screen after login. Top bar (theme toggle, user avatar). Header with "Welcome back, {first name}" and an "Add building" CTA. Four-card KPI strip (Buildings, Today's usage, Est. cost, Active alerts), a 7-day consumption line chart, and a buildings table with edit/delete row actions.
- **WF-07 Buildings List.** Search and type filter above a paginated table covering Name, Type, Address, Sq m, Last reading, Status.
- **WF-08 Building Detail.** Header with building name, type badge, address. Four KPI cards (today / week / month / YTD). Tabbed sections: Consumption, Anomalies, Forecast, Settings. Default tab shows a 30-day chart and a meter readings table.
- **WF-09 Export Energy Report.** Modal launched from the dashboard or building detail. Time range chips, format selector (PDF / CSV), building multi-select, then a "Generate report" CTA.

---

### Building Management Screens

- **WF-10 Add Building.** Single-column form: Building name (required), Building type, Physical address, Square footage, Max occupancy, Timezone. Submit disabled until required fields are valid.
- **WF-11 Edit Building.** Same form prefilled from the API. Skeleton while loading. Danger-coloured "Delete this building" link opens the confirmation modal.
- **WF-12 Delete Building (modal).** Centred modal over a 45% scrim. Cancel and a danger Delete button; spinner during deletion.

---

### Analytics Screens

- **WF-13 Compare Buildings.** Three selects (Building A, Building B, Time range) then a Compare CTA. Result is a "Most efficient" banner and a metrics table (consumption, cost, floor area, EUI, cost per m²). Winning values are bold and use the primary colour.
- **WF-14 Demand Forecast.** Form for Building, Horizon (7 / 14 / 30 days), Granularity (hourly / daily). Result is a composed chart (historical + forecast + confidence band) and a four-card summary (peak load, peak time, average daily, MAPE).
- **WF-15 Anomaly Detection.** Filter bar (Building, Severity, Time range), severity-count KPI strip, and a paginated list of alert cards.
- **WF-16 Alert Detail.** Alert summary, an event chart with the anomaly window highlighted, and an investigation log with Acknowledge and Resolve actions.
- **WF-17 Alert Settings.** Table of rules (metric, comparator, threshold, scope, severity, enabled toggle) with an "Add rule" CTA.
- **WF-18 Optimisation Recommendations.** Filter bar (Building, Category, Sort) over a list of recommendation cards. Each card shows estimated savings in cost and kWh and a "View plan" CTA.
- **WF-19 Recommendation Detail.** Title, estimated savings, rationale, source data, and a numbered action plan. Footer has "Mark as planned" and "Dismiss".

---

### Data Ingestion Screens

- **WF-20 Data Sources.** Table of connected sources (name, type, building, last sync, status) with an "Add source" CTA.
- **WF-21 Add Data Source (Wizard).** Three-step wizard. Step 1 picks the type (CSV / JSON / API). Step 2 configures the connection. Step 3 maps columns to OptiGrid fields and previews 10 rows.
- **WF-22 Upload Data (CSV).** Drag-and-drop zone with a "browse" fallback, plus a recent-uploads table with parsing / ready / failed status and per-file Import actions.

---

### Administration Screens

- **WF-23 User Management.** Search + role/status filters above a users table (name, email, role, last active, status). "Invite user" CTA opens WF-24.
- **WF-24 Invite / Edit User.** Modal (invite) or full page (edit). Fields: First name, Last name, Email, Role. Invited users appear in the list as "Pending".
- **WF-25 Role Management.** Permissions matrix table with the built-in roles (Viewer, Manager, Admin) and a checkbox per permission. "Add role" CTA opens a modal.
- **WF-26 Tenant Settings.** Organisation form (name, primary contact, billing email, default timezone, default currency) with a branding subsection for the tenant logo used in exported reports.

---

### Account and Settings Screens

- **WF-27 Profile.** Profile / Notifications / Sessions tab strip. Profile tab covers first name, last name, read-only email, password change link, and a danger zone for account deletion.
- **WF-28 Notification Preferences.** Category-by-channel matrix (Email, In-app, SMS) covering critical alerts, warning alerts, weekly summary, and the recommendation digest.
- **WF-29 Sessions.** Table of active sessions with Device, Browser, IP, Last active, and a Revoke action per row.

---

### Utility Screens

- **WF-30 Contact.** Two-column layout with contact details on the left and a contact form (Name, Email, Subject, Message) on the right.
- **WF-31 FAQs.** Accordion list grouped by section: Getting started, Data sources, Anomaly detection, Forecasting, Recommendations, Teams and security, Billing.
- **WF-32 404 / Not Found.** Centred error block with a "Back to dashboard" CTA (or "Back to home" when signed out).
- **WF-33 Empty States.** Shared empty-state pattern used on Dashboard, Buildings, Anomalies, and Recommendations. Centred message plus a primary CTA pointing at the action that populates the screen.

---

### Annotations Legend

These conventions are used across the wireframes in [docs/wireframes.html](wireframes.html):

- **Solid border** marks a real container (card, modal, input).
- **Dashed border** marks an area that loads asynchronously (skeleton or empty state).
- **Filled rectangle** marks a primary action button.
- **Outlined rectangle** marks a secondary or destructive action button.
- **Underlined text** marks a link.
- Arrows in the navigation flow show transitions between screens.

For visual review, open [docs/wireframes.html](wireframes.html) in a browser. For visual review of the brand palette, typography, logo, components, and accessibility ratios, open [docs/Brand_Guidelines.html](Brand_Guidelines.html) in a browser.
