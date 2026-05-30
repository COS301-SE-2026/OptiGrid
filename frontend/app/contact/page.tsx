
"use client";

import { useEffect } from "react";

export default function ContactUs() {
  useEffect(() => {
    const inter = document.createElement("link");
    inter.rel = "stylesheet";
    inter.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(inter);

    const space = document.createElement("link");
    space.rel = "stylesheet";
    space.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap";
    document.head.appendChild(space);

    const jetbrains = document.createElement("link");
    jetbrains.rel = "stylesheet";
    jetbrains.href =
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(jetbrains);
  }, []);

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
            maxWidth: "600px",
            width: "100%",
            padding: "var(--space-6)",
            textAlign: "center",
          }}
        >
          <h1>Contact Us</h1>

          <p className="text-muted">
            For any enquiries, please contact us at:
          </p>

          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=cos301.coreflow@gmail.com"
            className="btn btn-primary"
            style={{ display: "inline-flex" }}
          >
            cos301.coreflow@gmail.com
          </a>

          <div style={{ marginTop: "var(--space-5)" }}>
            <h3>Business Hours</h3>
            <p>Monday - Friday: 08:00 - 17:00</p>
            <p>Saturday: 09:00 - 15:00</p>
            <p>Sunday: Closed</p>
          </div>
        </div>
      </div>
    </div>
  );
}