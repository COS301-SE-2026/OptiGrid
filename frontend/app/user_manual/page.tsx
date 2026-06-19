"use client";

import React from "react";

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
            maxWidth: "900px",
            width: "100%",
            padding: "var(--space-6)",
          }}
        >
          <h1 style={{ marginBottom: "var(--space-5)" }}>Optigrid - User Manual</h1>

          <div style={{ display: "grid", gap: "var(--space-5)" }}>
  
            <div>
              <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
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
              <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
                2. Dashboard Guide
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
            </div>

            
            <div>
              <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
                3. Anomaly Detection System
              </h2>
              <ul style={{ 
                paddingLeft: "var(--space-5)", 
                margin: 0,
                color: "var(--brand-ink)",
                lineHeight: "var(--lh-body)",
              }}>
                <li>Detect abnormal spikes or drops.</li>
                <li>Identify unusual consumption patterns.</li>
                <li>Generate automated alerts.</li>
              </ul>
            </div>

            
            <div>
              <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
                4. Energy Demand Forecasting
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
            </div>

            
            <div>
              <h2 style={{ color: "var(--brand-primary)", marginBottom: "var(--space-3)" }}>
                5. Support
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