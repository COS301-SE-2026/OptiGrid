"use client";
import { useState } from "react";
import Link from "next/link";

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
        setSubmitError(`Your message was not sent. ${data.message || data.error || "Please try again."}`);
      }
    } catch {
      setSubmitError("We could not reach the server. Check your connection and try again.");
    }
  };

  return (
    <div className="contact-wrap">
      <div className="card contact-card">
        <div className="contact-primary">
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
                rows={5}
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
        </div>

        <aside className="contact-aside" aria-label="More ways to get help">
          <section className="contact-hours" aria-label="Operating hours">
            <h2>Operating Hours</h2>
            <p>Monday - Friday: 08:00 - 17:00</p>
            <p>Saturday: 09:00 - 13:00</p>
            <p>Sunday: Closed</p>
          </section>

          <section className="contact-more" aria-labelledby="contact-more-title">
            <h2 id="contact-more-title">Looking for a quick answer?</h2>
            <p>Most questions are already covered in the Help Centre.</p>
            <div className="contact-links">
              <Link href="/faqs">Read the FAQs</Link>
              <Link href="/help/tutorials">Watch a tutorial</Link>
              <Link href="/help">Open the Help Centre</Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}