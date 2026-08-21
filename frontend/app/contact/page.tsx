"use client";

import { useState } from "react";

export default function ContactUs() {
  const [inquiryType, setInquiryType] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError("");

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
      if (resp.ok) {
        setSubmitted(true);
        setInquiryType("");
        setSubject("");
        setDescription("");
      } else {
        setSubmitError(`Message not sent, FAILED: ${data.message || data.error}`);
      }
    } catch {
      setSubmitError("Network Issue, please ensure you have a valid connection or try again later");
    }
  };

  return (
    <div className="dashboard-page">
      <main role="main" aria-label="Contact us main content">
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
                  <label className="label" htmlFor="inquiryType">Inquiry Type</label>
                  <select
                    id="inquiryType"
                    value={inquiryType}
                    onChange={(e) => setInquiryType(e.target.value)}
                    className="select"
                    required
                    aria-label="Select an inquiry type"
                  >
                    <option value="">Select an inquiry type</option>
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Billing & Payments">Billing & Payments</option>
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="subject">Subject</label>
                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="input"
                    placeholder="Enter a subject"
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="description">Description</label>
                  <textarea
                    id="description"
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
                      backgroundColor: "#3A6B7C",
                      color: "#FFFFFF",
                    }}
                  >
                    Submit
                  </button>
                </div>

                {submitted && (
                  <output
                    className="badge badge-success"
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: "var(--space-3)",
                      marginTop: "var(--space-2)",
                    }}
                  >
                    Your inquiry has been submitted successfully.
                  </output>
                )}

                {submitError && (
                  <p role="alert" style={{
                      color: "var(--brand-danger)",
                      fontSize: "var(--fs-small)",
                      marginTop: "var(--space-2)"
                    }}
                  >
                    {submitError}
                  </p>
                )}
              </div>
            </form>

            <section aria-label="Operating hours">
              <div
                className="card"
                style={{
                  marginTop: "var(--space-5)",
                  padding: "var(--space-4)",
                  backgroundColor: "var(--brand-surface-alt)",
                }}
              >
                <h2 style={{ 
                  marginBottom: "var(--space-3)", 
                  color: "var(--brand-primary)",
                  fontSize: "var(--fs-h3)",
                  fontWeight: "var(--fw-semibold)",
                  fontFamily: "var(--font-heading)",
                }}>
                  Operating Hours
                </h2>
                <p>Monday - Friday: 08:00 - 17:00</p>
                <p>Saturday: 09:00 - 13:00</p>
                <p>Sunday: Closed</p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}