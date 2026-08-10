"use client";

import React from "react";

import dashboardScreenshot from "./dashboard screenshot.png";
import landingsignup from "./landingsignup.png";
import signuplogin from "./signuplogin.png";
import dashboardadd from "./dashboardadd.png";
import add from "./add.png";
import editanddelete from "./editanddelete.png";
import dashcompare from "./dashcompare.png";
import compare from "./compare.png";
import dashforecast from "./dashforecast.png";
import forecast from "./forecast.png";

export default function UserManualPage() {
  return (
    <div className="dashboard-page">
      <main role="main" aria-label="User manual main content">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "var(--space-6)",
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: "1000px",
              width: "100%",
              padding: "var(--space-6)",
            }}
          >
            <h1 style={{ marginBottom: "var(--space-5)" }}>Optigrid - User Manual</h1>

            <div style={{ display: "grid", gap: "var(--space-6)" }}>
              <section aria-label="Introduction">
                <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
                  1. Introduction
                </h2>
                <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                  Optigrid is a centralised, intelligent energy management system
                  that integrates data ingestion, predictive analytics, and optimisation
                  insights to improve operational efficiency and sustainability.
                </p>
                <ul
                  style={{
                    paddingLeft: "var(--space-5)",
                    margin: 0,
                    color: "var(--brand-ink)",
                    lineHeight: "var(--lh-body)",
                  }}
                >
                  <li>Monitors real-time and historical energy consumption across multiple buildings.</li>
                  <li>Predicts future energy demand.</li>
                  <li>Detects inefficiencies and abnormal usage patterns.</li>
                  <li>Recommends optimisation strategies.</li>
                </ul>
              </section>

              <section aria-label="Login and Signup">
                <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
                  2. Login and Signup
                </h2>
                <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                  Sign up and login using your work email and password.
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "var(--space-4)",
                    marginTop: "var(--space-3)",
                  }}
                >
                  <div>
                    <img
                      src={landingsignup.src}
                      alt="Sign up page showing the registration form"
                      style={{
                        width: "100%",
                        height: "auto",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--brand-border)",
                        maxHeight: "400px",
                        objectFit: "contain",
                        backgroundColor: "var(--brand-surface-alt)",
                      }}
                    />
                  </div>
                  <div>
                    <img
                      src={signuplogin.src}
                      alt="Login page showing the login form"
                      style={{
                        width: "100%",
                        height: "auto",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--brand-border)",
                        maxHeight: "400px",
                        objectFit: "contain",
                        backgroundColor: "var(--brand-surface-alt)",
                      }}
                    />
                  </div>
                </div>
              </section>

              <section aria-label="Dashboard Guide">
                <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
                  3. Dashboard Guide
                </h2>
                <ul
                  style={{
                    paddingLeft: "var(--space-5)",
                    margin: 0,
                    color: "var(--brand-ink)",
                    lineHeight: "var(--lh-body)",
                  }}
                >
                  <li>View energy usage per building.</li>
                  <li>Compare buildings.</li>
                  <li>Identify peak usage trends.</li>
                  <li>Live energy monitoring.</li>
                </ul>
                <div style={{ marginTop: "var(--space-3)" }}>
                  <img
                    src={dashboardScreenshot.src}
                    alt="Dashboard overview showing energy consumption metrics and charts"
                    style={{
                      width: "100%",
                      height: "auto",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--brand-border)",
                      maxHeight: "400px",
                      objectFit: "contain",
                      backgroundColor: "var(--brand-surface-alt)",
                    }}
                  />
                </div>
              </section>

              <section aria-label="Buildings management">
                <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
                  4. Buildings
                </h2>
                <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>
                  Features for creating, editing, and deleting a building.
                </p>

                <div style={{ marginBottom: "var(--space-5)" }}>
                  <h3 style={{ color: "var(--brand-secondary)", marginBottom: "var(--space-2)" }}>
                    Create Building
                  </h3>
                  <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                    Enter building details to add a new building.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: "var(--space-4)",
                    }}
                  >
                    <div>
                      <img
                        src={dashboardadd.src}
                        alt="Add building button on the dashboard"
                        style={{
                          width: "100%",
                          height: "auto",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--brand-border)",
                          maxHeight: "250px",
                          objectFit: "contain",
                          backgroundColor: "var(--brand-surface-alt)",
                        }}
                      />
                    </div>
                    <div>
                      <img
                        src={add.src}
                        alt="Building creation form with input fields"
                        style={{
                          width: "100%",
                          height: "auto",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--brand-border)",
                          maxHeight: "250px",
                          objectFit: "contain",
                          backgroundColor: "var(--brand-surface-alt)",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ color: "var(--brand-secondary)", marginBottom: "var(--space-2)" }}>
                    Edit and Delete Building
                  </h3>
                  <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                    Manage existing buildings by editing details or deleting.
                  </p>
                  <img
                    src={editanddelete.src}
                    alt="Edit and delete building options"
                    style={{
                      width: "100%",
                      height: "auto",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--brand-border)",
                      maxHeight: "300px",
                      objectFit: "contain",
                      backgroundColor: "var(--brand-surface-alt)",
                    }}
                  />
                </div>
              </section>

              <section aria-label="Compare Buildings">
                <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
                  5. Compare Buildings
                </h2>
                <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                  Compare energy consumption of two different buildings.
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "var(--space-4)",
                  }}
                >
                  <div>
                    <img
                      src={dashcompare.src}
                      alt="Compare buildings dashboard view"
                      style={{
                        width: "100%",
                        height: "auto",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--brand-border)",
                        maxHeight: "250px",
                        objectFit: "contain",
                        backgroundColor: "var(--brand-surface-alt)",
                      }}
                    />
                  </div>
                  <div>
                    <img
                      src={compare.src}
                      alt="Building comparison chart showing energy usage"
                      style={{
                        width: "100%",
                        height: "auto",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--brand-border)",
                        maxHeight: "250px",
                        objectFit: "contain",
                        backgroundColor: "var(--brand-surface-alt)",
                      }}
                    />
                  </div>
                </div>
              </section>

              <section aria-label="Energy Demand Forecasting">
                <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
                  6. Energy Demand Forecasting
                </h2>
                <ul
                  style={{
                    paddingLeft: "var(--space-5)",
                    margin: 0,
                    color: "var(--brand-ink)",
                    lineHeight: "var(--lh-body)",
                  }}
                >
                  <li>Short-term demand prediction.</li>
                  <li>Use historical and contextual inputs.</li>
                </ul>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "var(--space-4)",
                    marginTop: "var(--space-3)",
                  }}
                >
                  <div>
                    <img
                      src={dashforecast.src}
                      alt="Forecast dashboard showing demand predictions"
                      style={{
                        width: "100%",
                        height: "auto",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--brand-border)",
                        maxHeight: "250px",
                        objectFit: "contain",
                        backgroundColor: "var(--brand-surface-alt)",
                      }}
                    />
                  </div>
                  <div>
                    <img
                      src={forecast.src}
                      alt="Forecast chart showing predicted energy demand"
                      style={{
                        width: "100%",
                        height: "auto",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--brand-border)",
                        maxHeight: "250px",
                        objectFit: "contain",
                        backgroundColor: "var(--brand-surface-alt)",
                      }}
                    />
                  </div>
                </div>
              </section>

              <section aria-label="Support">
                <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
                  7. Support
                </h2>
                <ul
                  style={{
                    paddingLeft: "var(--space-5)",
                    margin: 0,
                    color: "var(--brand-ink)",
                    lineHeight: "var(--lh-body)",
                  }}
                >
                  <li>Email: cos301.coreflow@gmail.com</li>
                  <li>Response time: 24-48 hours</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}