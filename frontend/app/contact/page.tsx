"use client";

import { useState, useEffect } from "react";

export default function ContactUs() {
  const [inquiryType, setInquiryType] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const resp = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inquiryType,
          subject,
          message: description,
        }),
      });

      const data = await resp.json();
      if(resp.ok) {
        setSubmitted(true);

        setInquiryType("");
        setSubject("");
        setDescription("");
      } 
      else {
        alert(`Message not sent, FAILED: ${data.message || data.error}`);
      }
    } 
    catch {
      alert("Network Issue, please ensure you have a valid connection or try again later");
    }
  };

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
            maxWidth: "700px",
            width: "100%",
            padding: "var(--space-6)",
          }}
        >
          <h1 style={{ marginBottom: "var(--space-2)" }}>Contact Us</h1>

          <p className="text-muted" style={{ marginBottom: "var(--space-5)" }}>
            Please provide details about your inquiry.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <div>
                <label className="label">Inquiry Type</label>
                <select
                  value={inquiryType}
                  onChange={(e) => setInquiryType(e.target.value)}
                  className="select"
                  required
                >
                  <option value="">Select an inquiry type</option>
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Billing & Payments">Billing & Payments</option>
                  
                  
                </select>
              </div>

              <div>
                <label className="label">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input"
                  placeholder="Enter a subject"
                  required
                />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input"
                  placeholder="Describe your inquiry."
                  style={{ resize: "vertical" }}
                  required
                />
              </div>

              <div style={{ marginTop: "var(--space-2)" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                  }}
                >
                  Submit
                </button>
              </div>

              {submitted && (
                <div
                  className="badge badge-success"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "var(--space-3)",
                    marginTop: "var(--space-2)",
                  }}
                >
                  Your inquiry has been submitted successfully.
                </div>
              )}
            </div>
          </form>

          <div
            className="card"
            style={{
              marginTop: "var(--space-5)",
              padding: "var(--space-4)",
              backgroundColor: "var(--brand-surface-alt)",
            }}
          >
            <h3 style={{ marginBottom: "var(--space-3)", color: "var(--brand-primary-cta)" }}>
              Operating Hours
            </h3>
            <p>Monday - Friday: 08:00 - 17:00</p>
            <p>Saturday: 09:00 - 13:00</p>
            <p>Sunday: Closed</p>
          </div>
        </div>
      </div>
    </div>
  );
}