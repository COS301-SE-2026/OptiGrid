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
            
            <div>
              <h2 style={{ color: "var(--brand-primary-cta)", marginBottom: "var(--space-3)" }}>
                1. Introduction
              </h2>
              <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                Optigrid is a centralised, intelligent energy management system 
                that integrates data ingestion, predictive analytics, and optimisation 
                insights to improve operational efficiency and sustainability.
              </p>
              <ul style={{ 
                paddingLeft: "var(--space-5)", 
                margin: 0,
                color: "var(--brand-ink)",
                lineHeight: "var(--lh-body)",
              }}>
                <li>Monitors real-time and historical energy consumption across multiple buildings.</li>
                <li>Predicts future energy demand.</li>
                <li>Detects inefficiencies and abnormal usage patterns.</li>
                <li>Recommends optimisation strategies.</li>
              </ul>
            </div>

            
            <div>
              <h2 style={{ color: "var(--brand-primary-cta)", marginBottom: "var(--space-3)" }}>
                2. Login and Signup
              </h2>
              <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                Sign up and login using your work email and password.
              </p>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "var(--space-4)",
                marginTop: "var(--space-3)",
              }}>
                <div>
                  <img
                    src={landingsignup.src}
                    alt={"OptiGrid landing page. The “Get started free” button, circled in red, sits below the headline next to “Book a demo”."}
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
                    alt={"Side-by-side sign-up and login forms. Sign up asks for first name, last name, work email, password, confirm password, and agreement to the terms. Login asks for email and password, with “Remember me”, “Forgot password?” and a “Continue with SSO” option."}
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
            </div>

            
            <div>
              <h2 style={{ color: "var(--brand-primary-cta)", marginBottom: "var(--space-3)" }}>
                3. Dashboard Guide
              </h2>
              <ul style={{ 
                paddingLeft: "var(--space-5)", 
                margin: 0,
                color: "var(--brand-ink)",
                lineHeight: "var(--lh-body)",
              }}>
                <li>View energy usage per building.</li>
                <li>Compare buildings.</li>
                <li>Identify peak usage trends.</li>
                <li>Live energy monitoring.</li>
              </ul>
              <div style={{ marginTop: "var(--space-3)" }}>
                <img
                  src={dashboardScreenshot.src}
                  alt={"OptiGrid dashboard. A left menu lists Dashboard, Compare and Forecast. Four summary cards show 3 buildings, today’s usage 4,182 kWh, estimated cost R 9,420, and 2 active alerts. Below is a seven-day portfolio consumption line chart, then a table of buildings with name, type, today’s kWh, status and edit and delete actions."}
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

 
            <div>
              <h2 style={{ color: "var(--brand-primary-cta)", marginBottom: "var(--space-3)" }}>
                4. Buildings
              </h2>
              <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>
                Features for creating, editing, and deleting a building.
              </p>
              
              <div style={{ marginBottom: "var(--space-5)" }}>
                <h3 style={{ color: "var(--brand-secondary-text)", marginBottom: "var(--space-2)" }}>
                  Create Building
                </h3>
                <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                  Enter building details to add a new building.
                </p>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "var(--space-4)",
                }}>
                  <div>
                    <img
                      src={dashboardadd.src}
                      alt={"Dashboard with the “+ Add building” button in the top right circled in red."}
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
                      alt={"The “Add a building” form, with fields for building name, address, type, operating hours, floor area, utility tariff, number of occupants and optional IoT device IDs, plus Cancel and “Save building” buttons."}
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
                <h3 style={{ color: "var(--brand-secondary-text)", marginBottom: "var(--space-2)" }}>
                  Edit and Delete Building
                </h3>
                <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                  Manage existing buildings by editing details or deleting.
                </p>
                <img
                  src={editanddelete.src}
                  alt={"Dashboard buildings table with the edit (pencil) and delete (bin) icons on the Sandton HQ row circled in red."}
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
            </div>

 
            <div>
              <h2 style={{ color: "var(--brand-primary-cta)", marginBottom: "var(--space-3)" }}>
                5. Compare Buildings
              </h2>
              <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                Compare energy consumption of two different buildings.
              </p>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "var(--space-4)",
              }}>
                <div>
                  <img
                    src={dashcompare.src}
                    alt={"Dashboard with the “Compare” item in the left menu circled in red."}
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
                    alt={"Compare screen with Building A set to Sandton HQ and Building B to Rosebank Tower over the last 30 days by kWh total. A chart overlays both buildings’ consumption lines, and summary cards show 54,210 kWh, 47,830 kWh, a 13.3 percent difference, and 10.8 versus 9.2 per square metre."}
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
              <h2 style={{ color: "var(--brand-primary-cta)", marginBottom: "var(--space-3)" }}>
                6. Energy Demand Forecasting
              </h2>
              <ul style={{ 
                paddingLeft: "var(--space-5)", 
                margin: 0,
                color: "var(--brand-ink)",
                lineHeight: "var(--lh-body)",
              }}>
                <li>Short-term demand prediction.</li>
                <li>Use historical and contextual inputs.</li>
              </ul>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "var(--space-4)",
                marginTop: "var(--space-3)",
              }}>
                <div>
                  <img
                    src={dashforecast.src}
                    alt={"Dashboard with the “Forecast” item in the left menu circled in red."}
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
                    alt={"Forecast screen for Sandton HQ over a 7-day hourly horizon with the “Run forecast” button circled in red. The chart shows recorded history as a solid line continuing into a dashed prediction with a shaded 95 percent confidence interval. Summary cards report peak demand of 312 kWh on Wednesday at 14:00, an average of 1,920 kWh per day, and model accuracy of MAPE 4.8 percent."}
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
              <h2 style={{ color: "var(--brand-primary-cta)", marginBottom: "var(--space-3)" }}>
                7. Support
              </h2>
              <ul style={{ 
                paddingLeft: "var(--space-5)", 
                margin: 0,
                color: "var(--brand-ink)",
                lineHeight: "var(--lh-body)",
              }}>
                <li>Email: cos301.coreflow@gmail.com</li>
                <li>Response time: 24-48 hours</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}