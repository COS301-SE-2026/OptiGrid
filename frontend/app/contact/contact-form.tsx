"use client";
import { useState } from "react";

export function ContactForm() {
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
      } 
      else {
        setSubmitError(`Message not sent, FAILED: ${data.message || data.error}`);
      }
    } catch {
      setSubmitError("Network Issue, please ensure you have a valid connection or try again later");
    }
  };

  return (
    <div className="contact-wrap">
      <div className="card contact-card">
        <h1 className="contact-title">Contact Us</h1>
        <p className="text-muted contact-lede">Please provide details about your inquiry.</p>

        <form onSubmit={handleSubmit} className="contact-form">
          <div className="contact-field">
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

          <div className="contact-field">
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

          <div className="contact-field">
            <label className="label" htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              placeholder="Describe your inquiry."
              style={{ resize: "vertical" }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary contact-submit"
            style={{
              backgroundColor: "#3A6B7C",
              color: "#FFFFFF",
            }}
          >
            Submit
          </button>

          {submitted && (
            <output className="badge badge-success contact-status">
              Your inquiry has been submitted successfully.
            </output>
          )}

          {submitError && (
            <p role="alert" className="contact-error">
              {submitError}
            </p>
          )}
        </form>

        <section className="contact-hours" aria-label="Operating hours">
          <h2>Operating Hours</h2>
          <p>Monday - Friday: 08:00 - 17:00</p>
          <p>Saturday: 09:00 - 13:00</p>
          <p>Sunday: Closed</p>
        </section>
      </div>
    </div>
  );
}