"use client";

import { useEffect, useMemo, useState } from "react";

type Section = {
  id: string;
  number: string;
  title: string;
  body: React.ReactNode;
  snapshot?: {
    caption: string;
    alt: string;
    src?: string;
  };
};


function Lightbox({
  src,
  alt,
  caption,
  onClose,
}: {
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "color-mix(in srgb, var(--brand-ink) 78%, transparent)",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-5)",
        cursor: "zoom-out",
        animation: "manual-fade-in 0.2s ease",
      }}
    >
      <button
        type="button"
        aria-label="Close enlarged image"
        onClick={onClose}
        style={{
          position: "absolute",
          top: "var(--space-4)",
          right: "var(--space-4)",
          width: 40,
          height: 40,
          borderRadius: 999,
          border: "1px solid var(--brand-border)",
          background: "var(--brand-surface)",
          color: "var(--brand-ink)",
          fontSize: 20,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        x
      </button>

      <figure
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: 0,
          maxWidth: "min(1400px, 95vw)",
          maxHeight: "92vh",
          display: "grid",
          gap: "var(--space-3)",
          cursor: "default",
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "82vh",
            objectFit: "contain",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--brand-border)",
            background: "var(--brand-surface)",
            display: "block",
          }}
        />
        {caption && (
          <figcaption
            style={{
              textAlign: "center",
              color: "var(--brand-bg)",
              fontSize: "1rem",
              fontWeight: "var(--fw-medium)",
            }}
          >
            {caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

function Snapshot({
  caption,
  alt,
  src,
  onOpen,
}: {
  caption: string;
  alt: string;
  src?: string;
  onOpen: (src: string, alt: string, caption: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const clickable = Boolean(src);

  return (
    <figure
      style={{
        margin: "var(--space-5) 0 0",
        display: "grid",
        gap: "var(--space-2)",
      }}
    >
      <div
        onClick={() => {
          if (src) onOpen(src, alt, caption);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (clickable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onOpen(src!, alt, caption);
          }
        }}
        aria-label={clickable ? `Enlarge image: ${alt}` : undefined}
        style={{
          position: "relative",
          aspectRatio: "16 / 10",
          maxWidth: 560,
          margin: "0 auto",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--brand-border)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 6%, var(--brand-surface)), var(--brand-surface))",
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          cursor: clickable ? "zoom-in" : "default",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          transform: hovered && clickable ? "translateY(-2px)" : "translateY(0)",
          boxShadow:
            hovered && clickable
              ? "0 12px 28px rgba(11, 17, 32, 0.18)"
              : "var(--shadow-card)",
        }}
      >
        {src ? (
          <>
            <img
              src={src}
              alt={alt}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            <span
              aria-hidden
              style={{
                position: "absolute",
                bottom: 10,
                right: 10,
                padding: "6px 12px",
                borderRadius: 999,
                background:
                  "color-mix(in srgb, var(--brand-surface) 90%, transparent)",
                color: "var(--brand-ink)",
                fontSize: "0.8rem",
                fontWeight: "var(--fw-semibold)",
                border: "1px solid var(--brand-border)",
                opacity: hovered ? 1 : 0.85,
                transition: "opacity 0.15s ease",
                pointerEvents: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Click to enlarge
            </span>
          </>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "var(--space-2)",
              textAlign: "center",
              padding: "var(--space-5)",
              color: "var(--brand-ink-muted)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--radius-md)",
                background:
                  "color-mix(in srgb, var(--brand-primary) 14%, transparent)",
                color: "var(--brand-primary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                margin: "0 auto",
              }}
            >
              
            </span>
            <span
              style={{
                fontSize: "var(--fs-small)",
                fontWeight: "var(--fw-semibold)",
                color: "var(--brand-ink)",
              }}
            >
              {alt}
            </span>
            <span style={{ fontSize: "0.75rem" }}>
              Replace this placeholder with a screenshot
            </span>
          </div>
        )}
      </div>
      <figcaption
        className="dashboard-section-meta"
        style={{ fontSize: "0.95rem", textAlign: "center" }}
      >
        {caption}
      </figcaption>
    </figure>
  );
}

function InfoTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div
      className="card"
      style={{ overflow: "hidden", padding: 0, marginTop: "var(--space-4)" }}
    >
      <div style={{ overflow: "auto" }}>
        <table className="dashboard-table">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnomalyCallout({
  tone,
  title,
  children,
}: {
  tone: "danger" | "warning" | "info";
  title: string;
  children: React.ReactNode;
}) {
  const colours = {
    danger: {
      bg: "color-mix(in srgb, var(--brand-danger) 10%, transparent)",
      border: "var(--brand-danger)",
      text: "var(--badge-danger-text)",
    },
    warning: {
      bg: "color-mix(in srgb, var(--brand-warning) 10%, transparent)",
      border: "var(--brand-warning)",
      text: "var(--badge-warning-text)",
    },
    info: {
      bg: "color-mix(in srgb, var(--brand-primary) 10%, transparent)",
      border: "var(--brand-primary)",
      text: "var(--badge-default-text)",
    },
  }[tone];

  return (
    <div
      style={{
        padding: "var(--space-4)",
        borderRadius: "var(--radius-md)",
        background: colours.bg,
        borderLeft: `3px solid ${colours.border}`,
        marginTop: "var(--space-3)",
        display: "grid",
        gap: "var(--space-2)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "1rem",
          fontWeight: "var(--fw-semibold)",
          color: colours.text,
        }}
      >
        {title}
      </p>
      <div
        style={{
          margin: 0,
          fontSize: "1rem",
          color: "var(--brand-ink-muted)",
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: "introduction",
    number: "1",
    title: "Introduction",
    body: (
      <>
        <p>
          OptiGrid is a centralized, intelligent energy management system
          designed to help organizations monitor, analyze, and optimize their
          energy consumption. By integrating data ingestion, predictive
          analytics, and optimization insights, OptiGrid empowers users to
          improve operational efficiency, reduce energy costs, and enhance
          sustainability across their building portfolios.
        </p>

        <h3>Who should read this manual?</h3>
        <ul>
          <li>
            <strong>General Users</strong>  monitor energy usage, view
            dashboards, analyze reports, and manage personal account settings.
          </li>
          <li>
            <strong>Building Managers</strong>  responsible for the
            operational management of specific buildings.
          </li>
          <li>
            <strong>Administrators</strong>  oversee user access, building
            profiles, and system configuration.
          </li>
        </ul>

        <h3>Key features at a glance</h3>
        <ul>
          <li>
            <strong>Energy Monitoring Dashboard</strong>  real-time and
            historical visualization of energy consumption.
          </li>
          <li>
            <strong>Energy Demand Forecasting</strong>  predictive analytics
            for future energy needs.
          </li>
          <li>
            <strong>Building Comparison</strong>  analysis of energy
            performance across multiple buildings.
          </li>
          <li>
            <strong>Sensor Management</strong>  registering and monitoring IoT
            sensors within buildings.
          </li>
          <li>
            <strong>Anomaly Alerts</strong>  automatic detection of unusual
            consumption patterns.
          </li>
          <li>
            <strong>Role-Based Access</strong>  secure access controls tailored
            to different user roles.
          </li>
        </ul>
      </>
    ),
    snapshot: {
      caption: "Figure 1  The OptiGrid landing page",
      alt: "Landing page with hero, live portfolio panel and call to action",
      src:"/landingpage.png"
      
    },
  },
  {
    id: "getting-started",
    number: "2",
    title: "Getting Started",
    body: (
      <>
        <h3>System requirements</h3>
        <p>
          OptiGrid is a web-based platform. It runs in Chrome, Firefox, Edge, or
          Safari with a stable internet connection. The platform is accessible
          on desktop computers and laptops.
        </p>

        <h3>Accessing the platform</h3>
        <p>
          Open your browser and navigate to{" "}
          <a href="https://www.optigrid.co.za/" target="_blank" rel="noopener noreferrer">
            https://www.optigrid.co.za/
          </a>
          . The landing page introduces the platform and provides options to log
          in or create a new account.
        </p>

        <h3>Creating an account</h3>
        <ol>
          <li>On the landing page, click <strong>Sign Up</strong> or <strong>Register</strong>.</li>
          <li>
            Fill in the registration form: first name, last name, email address,
            and password.
          </li>
          <li>Click <strong>Create Account</strong> to complete registration.</li>
        </ol>

        <h3>Logging in</h3>
        <ol>
          <li>Go to the OptiGrid landing page.</li>
          <li>Click the <strong>Log In</strong> button.</li>
          <li>Enter your registered email address and password.</li>
          <li>Click <strong>Log In</strong> to access the dashboard.</li>
        </ol>

        <h3>Logging out</h3>
        <p>You can log out using either of the following methods:</p>
        <ul>
          <li>
            <strong>Navigation Bar</strong>  click <strong>Logout</strong> at the bottom of the sidebar.
          </li>
          <li>
            <strong>Settings Page</strong>  navigate to Settings and click <strong>Logout</strong>.
          </li>
        </ul>
      </>
    ),
    snapshot: {
      caption: "Figure 2:  The login page",
      alt: "Log in to your account with work email and password fields",
      src:"/loginpage.png"
    },
  },
  {
    id: "roles",
    number: "3",
    title: "Understanding User Roles",
    body: (
      <>
        <p>
          OptiGrid uses role-based access control to manage permissions and
          ensure users have appropriate access to features and data.
        </p>
        <InfoTable
          headers={["Role", "Capabilities"]}
          rows={[
            [
              <strong key="v">Viewer</strong>,
              "View dashboards and energy usage data. Receive basic reports. Cannot make changes to system configurations or data.",
            ],
            [
              <strong key="m">Building Manager</strong>,
              "Monitor and manage energy consumption for assigned buildings. Register sensors. View forecast data. Generate reports.",
            ],
            [
              <strong key="a">Administrator</strong>,
              "Full system access. Manage building profiles, user accounts, and role assignments. Configure IoT sensor connections. View and manage all data across the organization.",
            ],
          ]}
        />
      </>
    ),
  },
  {
    id: "navigation",
    number: "4",
    title: "Navigating the Interface",
    body: (
      <>
        <h3>The main dashboard</h3>
        <p>
          The main dashboard provides an overview of your energy data. Key
          elements include:
        </p>
        <ul>
          <li>
            <strong>Portfolio consumption chart</strong>  energy usage across
            the last 7 days.
          </li>
          <li>
            <strong>KPI cards</strong>  buildings count, today&apos;s usage,
            estimated cost, and active alerts.
          </li>
          <li>
            <strong>Building list</strong>  a table of all your buildings with
            status and quick actions.
          </li>
        </ul>

        <h3>The navigation menu</h3>
        <p>
          The navigation menu, located at the side of the page, provides access
          to the core areas of the platform. The specific items available
          depend on your user role.
        </p>
        <ul>
          <li><strong>Dashboard</strong>  the main overview page.</li>
          <li><strong>Compare</strong>  compare performance across buildings.</li>
          <li><strong>Live</strong>  real-time readings.</li>
          <li><strong>Forecast</strong>  predictive analytics.</li>
          <li><strong>Insights</strong>  recommended optimizations.</li>
          <li><strong>Compliance</strong>  regulatory tracking.</li>
          <li><strong>Anomaly</strong>  detected unusual patterns.</li>
          <li><strong>Settings</strong>  profile and appearance.</li>
          <li><strong>Help Centre</strong>  documentation and FAQs.</li>
          <li><strong>Contact Us</strong>  reach the team for support.</li>
          <li><strong>Logout</strong>  end your current session.</li>
        </ul>

        <h3>Switching between light and dark mode</h3>
        <p>
          Navigate to the Settings page and locate the Theme section. Toggle
          between light mode and dark mode to change the visual theme of the
          platform.
        </p>
      </>
    ),
    snapshot: {
      caption: "Figure 3: The main OptiGrid dashboard",
      alt: "Dashboard with sidebar navigation, KPI cards and portfolio consumption chart",
      src:"/dashboardpage.png"
    },
  },
  {
    id: "buildings",
    number: "5",
    title: "Working with Buildings",
    body: (
      <>
        <h3>Viewing your buildings</h3>
        <p>
          Navigate to the dashboard. The building list displays the name, type,
          total energy consumption in kilowatt-hours (kWh), and the current
          operational status for each building.
        </p>

        <h3>Adding a new building</h3>
        <ol>
          <li>On the dashboard, click <strong>Add building</strong>.</li>
          <li>
            Fill in the building details: name, type (e.g. Office, Retail,
            Residential), and physical address. Optionally, floor area, max
            occupancy, nominal voltage, current threshold, timezone, and
            geohash.
          </li>
          <li>Click <strong>Create building</strong>.</li>
        </ol>

        <h3>Viewing building details</h3>
        <p>
          Click on a building in the list to open its details page. This shows
          general information, building specifications, energy consumption over
          a selectable time range, and location details.
        </p>

      
        <h3>Deleting a building</h3>
        <p>
          Locate the delete icon next to the building&apos;s entry. Confirm the
          deletion when prompted.
        </p>
        <AnomalyCallout tone="danger" title="Warning">
          Deleting a building is a permanent action and cannot be undone.
        </AnomalyCallout>
      </>
    ),
    snapshot: {
      caption: "Figure 4:  Adding buildings",
      alt: "Building details form with name, type, address and specification fields",
      src:"/addbuildingsnap.png"
    },
  },
  {
    id: "sensors",
    number: "6",
    title: "Managing Sensors",
    body: (
      <>
        <h3>Viewing a building&apos;s sensors</h3>
        <p>
          Building Managers can view a building&apos;s sensors by navigating to
          the manage page and selecting the sensors tab. The list shows all
          registered sensors, their MAC address, current status, and the data
          they are collecting.
        </p>

        <h3>Registering a new sensor</h3>
        <ol>
          <li>Navigate to the manage page.</li>
          <li>Click <strong>Register sensor</strong>.</li>
          <li>
            Fill in the sensor registration form: MAC address, sensor type,
            unit, and location zone.
          </li>
          <li>Click <strong>Register</strong> to complete the process.</li>
        </ol>

        <h3>Viewing sensor details</h3>
        <p>
          Click the <strong>View</strong> button next to a sensor&apos;s entry
          to see all important details: building, MAC address, type, unit, zone,
          status, and installation date.
        </p>
      </>
    ),
    snapshot: {
      caption: "Figure 5:  Viewing and registering sensors",
      alt: "Sensors list with MAC address, type, zone, status and register button",
      src:"/sensorlist.png"
    },
  },
  {
    id: "monitoring",
    number: "7",
    title: "Monitoring Energy Usage",
    body: (
      <>
        <h3>Live energy monitoring</h3>
        <p>
          The live energy monitoring feature provides real-time visualization of
          energy consumption. This allows users to see current usage and
          identify immediate changes in demand.
        </p>

        <h3>Reading the dashboard charts</h3>
        <p>
          Line charts show trends in energy consumption over time  hourly,
          daily, or monthly.
        </p>

        <h3>Understanding the key figures</h3>
        <ul>
          <li>
            <strong>kWh</strong>  kilowatt-hours, the standard unit of
            measurement for energy consumption.
          </li>
          <li>
            <strong>Energy cost</strong>  an estimated cost based on the local
            utility rate and energy consumption.
          </li>
          <li>
            <strong>Peak usage</strong>  the highest energy consumption
            recorded during a specific period.
          </li>
        </ul>
      </>
    ),
    snapshot: {
      caption: "Figure 6  Live energy monitoring view",
      alt: "Real-time chart showing current energy consumption",
      src:"/livereadings.png"
    },
  },
  {
    id: "compare",
    number: "8",
    title: "Comparing Buildings",
    body: (
      <>
        <h3>Selecting buildings to compare</h3>
        <ol>
          <li>On the dashboard, navigate to the <strong>Compare</strong> page.</li>
          <li>Choose the two buildings you wish to compare from your building list.</li>
          <li>Select a time range for the comparison.</li>
          <li>Choose the metric to analyze (cost or energy).</li>
          <li>The comparison updates automatically as you change your selections.</li>
        </ol>
        <p>
          The comparison view shows total cost and floor area for each building,
          a daily comparison chart, and key insights such as efficiency ratio
          and total difference.
        </p>
      </>
    ),
    snapshot: {
      caption: "Figure 7:  Comparing building energy usage",
      alt: "Comparison page with building selectors, metric, date range and totals",
      src: "/compare.png"
    },
  },
  {
    id: "forecast",
    number: "9",
    title: "Energy Demand Forecasting",
    body: (
      <>
        <h3>Running a forecast</h3>
        <ol>
          <li>Navigate to the <strong>Forecast</strong> page from the dashboard.</li>
          <li>Select the building you want to analyze.</li>
          <li>Choose the horizon weekly (next 7 days) or monthly (next 12 weeks).</li>
          <li>Click <strong>Run Forecast</strong> to generate a prediction.</li>
        </ol>

        <h3>Reading the forecast chart</h3>
        <ul>
          <li>
            <strong>Demand trend graph</strong>  shows the predicted future
            demand.
          </li>
          <li>
            <strong>Peak demand</strong>  the highest predicted demand.
          </li>
          <li>
            <strong>Average kWh per day</strong>  the average energy consumption
            forecasted per day.
          </li>
          <li>
            <strong>Model accuracy</strong>  an indication of the forecast
            model&apos;s reliability.
          </li>
        </ul>

        <h3>Understanding forecast accuracy</h3>
        <p>
          The forecast accuracy metric helps you understand the reliability of
          the prediction. A higher percentage (or lower MAPE) indicates a more
          confident forecast.
        </p>
      </>
    ),
    snapshot: {
      caption: "Figure 8:  Forecast results and chart",
      alt: "Demand trend chart with peak demand, average per day and model accuracy cards",
      src:"/forecast.png"
    },
  },
  {
    id: "anomaly",
    number: "10",
    title: "Anomaly Alerts",
    body: (
      <>
        <p>
          OptiGrid continuously analyses incoming sensor data to detect unusual
          consumption patterns. When the platform identifies a significant
          deviation from the expected baseline, it raises an anomaly alert.
        </p>

        <h3>How anomalies are detected</h3>
        <ul>
          <li>
            <strong>Statistical deviation</strong>  a reading that sits a
            configurable number of standard deviations from the recent baseline.
          </li>
          <li>
            <strong>Threshold breach</strong>  a value that exceeds a fixed
            maximum or minimum set per building or per sensor.
          </li>
          <li>
            <strong>Pattern shift</strong>  a sustained change in the daily or
            weekly shape of consumption.
          </li>
        </ul>

        <h3>Severity levels</h3>
        <InfoTable
          headers={["Severity", "Meaning"]}
          rows={[
            [
              <span key="l" className="badge badge-default">Low</span>,
              "Minor deviation. Worth noting but not urgent.",
            ],
            [
              <span key="m" className="badge badge-warning">Medium</span>,
              "Noticeable deviation. Review within the day.",
            ],
            [
              <span key="h" className="badge badge-danger">High</span>,
              "Significant deviation. Investigate promptly.",
            ],
            [
              <span key="c" className="badge badge-danger">Critical</span>,
              "Severe or sustained deviation. Immediate attention required.",
            ],
          ]}
        />

        <h3>Viewing and managing alerts</h3>
        <ol>
          <li>Navigate to the <strong>Anomaly</strong> page from the sidebar.</li>
          <li>
            Use the filters to narrow by building, status, and severity, or
            search by building name or description.
          </li>
          <li>
            Resolve or ignore the alert  both actions are recorded against your
            user account.
          </li>
        </ol>

      </>
    ),
    snapshot: {
      caption: "Figure 9  Anomaly alerts page with filters and table",
      alt: "Anomaly page with building, status and severity filters plus a table of alerts",
      src:"/anomaly.png"
    },
  },
  {
    id: "manager",
    number: "11",
    title: "Manager Features",
    body: (
      <>
        <h3>Viewing your assigned buildings</h3>
        <p>
          Upon logging in as a Building Manager, you will see a view focused on
          the buildings assigned to you. The table shows lifecycle, energy
          usage, owner, and quick actions.
        </p>

        <h3>Filtering and sorting buildings</h3>
        <p>
          Managers can filter and sort the building list by lifecycle state and
          energy usage to quickly find the information they need.
        </p>
      </>
    ),
    snapshot: {
      caption: "Figure 10:  Manager view of assigned buildings",
      alt: "Manager building list with lifecycle, energy usage, owner and action buttons",
      src:"/managerassigned.png"
    },
  },
  {
    id: "admin",
    number: "12",
    title: "Administrator Features",
    body: (
      <>
        <h3>Managing all buildings</h3>
        <p>
          Administrators can view, edit, and delete all buildings within
          OptiGrid, and see totals grouped by lifecycle state  total, active,
          inactive, provisioning, provisioning failed, assigned, and
          unassigned.
        </p>

        <h3>Managing users</h3>
        <p>
          The user management feature allows administrators to view all users,
          assign roles, and manage building assignments. Users are grouped by
          role and can be filtered by name or email.
        </p>
      </>
    ),
    snapshot: {
      caption: "Figure 11: Admin views for buildings and users",
      alt: "Admin dashboard with KPI tiles, building table and user management panel",
      src: "/adminpagebuildings.png"
    },
  },
  {
    id: "settings",
    number: "13",
    title: "Account Settings",
    body: (
      <>
        <h3>Updating your profile</h3>
        <ol>
          <li>Navigate to the Settings page.</li>
          <li>Locate the profile section.</li>
          <li>Update your information, such as your name and email address.</li>
          <li>Click <strong>Save changes</strong> to apply.</li>
        </ol>
      </>
    ),
    snapshot: {
      caption: "Figure 12: Updating user profile",
      alt: "Settings page with profile information fields and save button",
      src:"/settings.png"
    },
  },
  {
    id: "troubleshooting",
    number: "14",
    title: "Troubleshooting",
    body: (
      <InfoTable
        headers={["Problem", "Solution"]}
        rows={[
          [
            "Cannot log in.",
            "Verify your email and password. Use the 'Forgot Password' link to reset your password if needed.",
          ],
          [
            "No data is showing for a building.",
            "Check the sensors' status to ensure they are connected and reporting.",
          ],
          [
            "The dashboard is loading slowly.",
            "Check your internet connection. Try refreshing the browser.",
          ],
        ]}
      />
    ),
  },
  {
    id: "faq",
    number: "15",
    title: "Frequently Asked Questions",
    body: (
      <>
        <h3>Sign up &amp; account</h3>
        <p>
          <strong>How do I create an OptiGrid account?</strong> Click{" "}
          <em>Sign up</em> on the landing page, complete the registration form,
          and click <em>Create Account</em>.
        </p>
        <p>
          <strong>Can I sign up with an email that is already registered?</strong>{" "}
          No use the password reset flow instead, or contact support if you
          no longer have access.
        </p>

        <h3>Login &amp; session</h3>
        <p>
          <strong>How do I log in?</strong> Click <em>Log In</em> on the
          landing page, enter your credentials, and click <em>Log In</em>.
        </p>
        <p>
          <strong>How do I log out?</strong> Use the <em>Logout</em> button at
          the bottom of the sidebar, or from the Settings page.
        </p>

        <h3>Appearance</h3>
        <p>
          <strong>Does OptiGrid support dark mode?</strong> Yes  toggle the
          theme from the Settings page under the Theme section.
        </p>
      </>
    ),
  },
  {
    id: "support",
    number: "16",
    title: "Getting Help and Support",
    body: (
      <>
        <h3>Contacting support</h3>
        <p>
          If you encounter an issue not covered in this manual or the FAQ, you
          can contact the OptiGrid support team directly.
        </p>
        <ol>
          <li>Navigate to the Help or Support page.</li>
          <li>Select the appropriate inquiry type from the dropdown menu.</li>
          <li>Enter a subject that clearly describes the issue.</li>
          <li>Provide a detailed description of the problem in the text box.</li>
          <li>Click <strong>Submit</strong> to send your request.</li>
        </ol>
      </>
    ),
  },
];

export default function ManualPage() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);
  const [lightbox, setLightbox] = useState<{
    src: string;
    alt: string;
    caption: string;
  } | null>(null);

  const toc = useMemo(
    () =>
      SECTIONS.map((s) => ({
        id: s.id,
        number: s.number,
        title: s.title,
      })),
    []
  );

  const handleJump = (id: string) => {
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const openLightbox = (src: string, alt: string, caption: string) => {
    setLightbox({ src, alt, caption });
  };

  return (
    <div>
    
      <header
        style={{
          position: "relative",
          padding: "var(--space-7) var(--space-6)",
          borderRadius: "var(--radius-lg)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 16%, var(--brand-surface)) 0%, var(--brand-surface) 65%)",
          border: "1px solid var(--brand-border)",
          marginBottom: "var(--space-6)",
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--brand-primary) 28%, transparent) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "grid",
            gap: "var(--space-3)",
            maxWidth: 720,
          }}
        >
          
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(2.25rem, 4.5vw, 3.25rem)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: "var(--brand-ink)",
            }}
          >
            OptiGrid User Manual
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: "1.125rem",
              color: "var(--brand-ink-muted)",
              lineHeight: 1.6,
              maxWidth: 620,
            }}
          >
            Everything you need to know about OptiGrid — from your first login
            to managing sensors, forecasts, and anomaly alerts across your
            building portfolio.
          </p>

          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              flexWrap: "wrap",
              marginTop: "var(--space-2)",
            }}
          >
            <span className="badge badge-default">Version 1.0</span>
            <span className="badge badge-default">July 2026</span>
            <span className="badge badge-default">Team Coreflow</span>
          </div>
        </div>
      </header>

      <div
        className="manual-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 300px) minmax(0, 1fr)",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
      >
        
        <aside
          className="card manual-toc"
          aria-label="Manual contents"
          style={{
            position: "sticky",
            top: "var(--space-5)",
            padding: "var(--space-5)",
            maxHeight: "calc(100vh - var(--space-6))",
            overflowY: "auto",
          }}
        >
          <p
            style={{
              margin: "0 0 var(--space-4)",
              fontFamily: "var(--font-heading)",
              fontSize: "1.25rem",
              fontWeight: "var(--fw-bold)",
              color: "var(--brand-ink)",
              letterSpacing: "0.02em",
            }}
          >
            Contents
          </p>
          <nav>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: 4,
              }}
            >
              {toc.map((item) => {
                const isActive = item.id === activeId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleJump(item.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        textAlign: "left",
                        background: isActive
                          ? "color-mix(in srgb, var(--brand-primary) 14%, transparent)"
                          : "transparent",
                        color: isActive
                          ? "var(--brand-primary-cta)"
                          : "var(--brand-ink-muted)",
                        border: "none",
                        borderRadius: "var(--radius-md)",
                        padding: "10px 12px",
                        fontSize: "1rem",
                        fontWeight: isActive
                          ? "var(--fw-semibold)"
                          : "var(--fw-regular)",
                        cursor: "pointer",
                        transition:
                          "background-color 0.15s ease, color 0.15s ease",
                      }}
                    >
                      <span
                        className="metric"
                        style={{
                          minWidth: 26,
                          fontSize: "0.85rem",
                          color: isActive
                            ? "var(--brand-primary-cta)"
                            : "var(--brand-primary)",
                          fontWeight: "var(--fw-semibold)",
                        }}
                      >
                        {item.number.padStart(2, "0")}
                      </span>
                      <span style={{ lineHeight: 1.35 }}>{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        
        <div style={{ display: "grid", gap: "var(--space-5)", minWidth: 0 }}>
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="card manual-section"
              aria-labelledby={`${section.id}-heading`}
              style={{ scrollMarginTop: "var(--space-5)" }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  marginBottom: "var(--space-5)",
                  paddingBottom: "var(--space-4)",
                  borderBottom: "1px solid var(--brand-border)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 44,
                    height: 44,
                    padding: "0 10px",
                    borderRadius: "var(--radius-md)",
                    background:
                      "color-mix(in srgb, var(--brand-primary) 14%, transparent)",
                    color: "var(--brand-primary-cta)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "1.1rem",
                    fontWeight: "var(--fw-bold)",
                  }}
                >
                  {section.number.padStart(2, "0")}
                </span>
                <h2
                  id={`${section.id}-heading`}
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-heading)",
                    fontSize: "1.75rem",
                    fontWeight: "var(--fw-bold)",
                    letterSpacing: "-0.01em",
                    color: "var(--brand-ink)",
                    lineHeight: 1.15,
                  }}
                >
                  {section.title}
                </h2>
              </header>

              <div className="manual-body">{section.body}</div>

              {section.snapshot && (
                <Snapshot
                  caption={section.snapshot.caption}
                  alt={section.snapshot.alt}
                  src={section.snapshot.src}
                  onOpen={openLightbox}
                />
              )}
            </section>
          ))}

          <footer
            className="card"
            style={{
              textAlign: "center",
              padding: "var(--space-5)",
              color: "var(--brand-ink-muted)",
              fontSize: "1rem",
            }}
          >
            <p style={{ margin: 0 }}>
              OptiGrid User Manual · Version 1.0 · July 2026
            </p>
            <p style={{ margin: "4px 0 0" }}>
              Team Coreflow · COS 301 Capstone Project · University of Pretoria
            </p>
          </footer>
        </div>
      </div>

      {lightbox && (
        <Lightbox
          src={lightbox.src}
          alt={lightbox.alt}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}

      <style>{`
        .manual-body { line-height: 1.75; color: var(--brand-ink); font-size: 1.125rem; }
        .manual-body p { margin: 0 0 var(--space-3); font-size: 1.125rem; }
        .manual-body h3 {
          font-family: var(--font-heading);
          font-size: 1.3rem;
          font-weight: var(--fw-semibold);
          margin: var(--space-5) 0 var(--space-2);
          color: var(--brand-ink);
        }
        .manual-body h3:first-child { margin-top: 0; }
        .manual-body ul, .manual-body ol {
          margin: 0 0 var(--space-3);
          padding-left: var(--space-5);
          display: grid;
          gap: var(--space-2);
          font-size: 1.125rem;
        }
        .manual-body li { line-height: 1.75; }
        .manual-body a {
          color: var(--brand-primary-cta);
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        @keyframes manual-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (max-width: 900px) {
          .manual-layout {
            grid-template-columns: 1fr !important;
          }
          .manual-toc {
            position: static !important;
            max-height: none !important;
          }
        }
      `}</style>
    </div>
  );
}