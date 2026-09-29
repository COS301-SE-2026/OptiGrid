"use client";

import { useMemo, useState } from "react";
import { PageHeading } from "@/components/PageHeading";

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

function Snapshot({
  caption,
  alt,
  src,
}: {
  caption: string;
  alt: string;
  src?: string;
}) {
  return (
    <figure
      style={{
        margin: "var(--space-4) 0 0",
        display: "grid",
        gap: "var(--space-2)",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "16 / 10",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--brand-border)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 6%, var(--brand-surface)), var(--brand-surface))",
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
        }}
      >
        {src ? (
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
        style={{ fontSize: "0.75rem", textAlign: "center" }}
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
          fontSize: "var(--fs-small)",
          fontWeight: "var(--fw-semibold)",
          color: colours.text,
        }}
      >
        {title}
      </p>
      <div
        style={{
          margin: 0,
          fontSize: "var(--fs-small)",
          color: "var(--brand-ink-muted)",
          lineHeight: 1.6,
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

  return (
    <div>
      <PageHeading
        title="User Manual"
        subtitle="Everything you need to know about OptiGrid. Version 1.0: July 2026."
      />

      <div
        className="manual-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)",
          gap: "var(--space-5)",
          alignItems: "start",
        }}
      >
        
        <aside
          className="card manual-toc"
          aria-label="Manual contents"
          style={{
            position: "sticky",
            top: "var(--space-5)",
            padding: "var(--space-4)",
            maxHeight: "calc(100vh - var(--space-6))",
            overflowY: "auto",
          }}
        >
          <p
            className="dashboard-kpi-label"
            style={{ marginBottom: "var(--space-3)" }}
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
                gap: 2,
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
                        gap: 8,
                        width: "100%",
                        textAlign: "left",
                        background: isActive
                          ? "color-mix(in srgb, var(--brand-primary) 12%, transparent)"
                          : "transparent",
                        color: isActive
                          ? "var(--brand-primary-cta)"
                          : "var(--brand-ink-muted)",
                        border: "none",
                        borderRadius: "var(--radius-md)",
                        padding: "8px 10px",
                        fontSize: "var(--fs-small)",
                        fontWeight: isActive
                          ? "var(--fw-semibold)"
                          : "var(--fw-regular)",
                        cursor: "pointer",
                        transition: "background-color 0.15s ease",
                      }}
                    >
                      <span
                        className="metric"
                        style={{ minWidth: 18, fontSize: "0.75rem" }}
                      >
                        {item.number.padStart(2, "0")}
                      </span>
                      <span>{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        
        <div style={{ display: "grid", gap: "var(--space-5)" }}>
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
                  alignItems: "baseline",
                  gap: "var(--space-3)",
                  marginBottom: "var(--space-4)",
                  paddingBottom: "var(--space-3)",
                  borderBottom: "1px solid var(--brand-border)",
                }}
              >
                <span
                  className="metric"
                  style={{
                    fontSize: "var(--fs-small)",
                    color: "var(--brand-primary)",
                    fontWeight: "var(--fw-semibold)",
                  }}
                >
                  {section.number.padStart(2, "0")}
                </span>
                <h2
                  id={`${section.id}-heading`}
                  className="dashboard-section-title"
                  style={{ fontSize: "1.15rem", margin: 0 }}
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
              fontSize: "var(--fs-small)",
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

      <style>{`
        .manual-body { line-height: var(--lh-body); color: var(--brand-ink); }
        .manual-body p { margin: 0 0 var(--space-3); }
        .manual-body h3 {
          font-family: var(--font-heading);
          font-size: 0.95rem;
          font-weight: var(--fw-semibold);
          margin: var(--space-4) 0 var(--space-2);
          color: var(--brand-ink);
        }
        .manual-body h3:first-child { margin-top: 0; }
        .manual-body ul, .manual-body ol {
          margin: 0 0 var(--space-3);
          padding-left: var(--space-5);
          display: grid;
          gap: var(--space-2);
        }
        .manual-body li { line-height: 1.6; }
        .manual-body a {
          color: var(--brand-primary-cta);
          text-decoration: underline;
          text-underline-offset: 2px;
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