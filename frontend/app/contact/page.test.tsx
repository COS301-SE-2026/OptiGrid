import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ContactUs from "./page";

describe("ContactUs", () => {

  describe("Initial render", () => {
    it("renders the Contact Us heading", () => {
      render(<ContactUs />);
      expect(screen.getByRole("heading", { name: /contact us/i })).toBeInTheDocument();
    });

    it("renders the enquiries text", () => {
      render(<ContactUs />);
      expect(screen.getByText(/for any enquiries, please contact us at/i)).toBeInTheDocument();
    });

    it("renders the email link", () => {
      render(<ContactUs />);
      expect(screen.getByRole("link", { name: /cos301\.coreflow@gmail\.com/i })).toBeInTheDocument();
    });

    it("email link points to Gmail URL", () => {
      render(<ContactUs />);
      const link = screen.getByRole("link", { name: /cos301\.coreflow@gmail\.com/i });
      expect(link).toHaveAttribute(
        "href",
        "https://mail.google.com/mail/?view=cm&fs=1&to=cos301.coreflow@gmail.com"
      );
    });

    it("renders the Business Hours", () => {
      render(<ContactUs />);
      expect(screen.getByRole("heading", { name: /business hours/i })).toBeInTheDocument();
    });
  });

  describe("Business hours", () => {
    it("renders Monday - Friday hours", () => {
      render(<ContactUs />);
      expect(screen.getByText(/monday - friday/i)).toBeInTheDocument();
      expect(screen.getByText(/monday - friday.*08:00.*17:00/i)).toBeInTheDocument();
    });

    it("renders Saturday hours", () => {
      render(<ContactUs />);
      expect(screen.getByText(/saturday.*09:00.*15:00/i)).toBeInTheDocument();
    });

    it("renders Sunday as Closed", () => {
      render(<ContactUs />);
      expect(screen.getByText(/sunday.*closed/i)).toBeInTheDocument();
    });
  });

  describe("Font loading", () => {
    it("appends Inter font link on mount", () => {
      render(<ContactUs />);
      const links = Array.from(document.head.querySelectorAll("link[rel='stylesheet']"));
      const hrefs = links.map((l) => (l as HTMLLinkElement).href);
      expect(hrefs.some((h) => h.includes("Inter"))).toBe(true);
    });

    it("appends Space Grotesk font link on mount", () => {
      render(<ContactUs />);
      const links = Array.from(document.head.querySelectorAll("link[rel='stylesheet']"));
      const hrefs = links.map((l) => (l as HTMLLinkElement).href);
      expect(hrefs.some((h) => h.includes("Space+Grotesk"))).toBe(true);
    });

    it("appends JetBrains Mono font link on mount", () => {
      render(<ContactUs />);
      const links = Array.from(document.head.querySelectorAll("link[rel='stylesheet']"));
      const hrefs = links.map((l) => (l as HTMLLinkElement).href);
      expect(hrefs.some((h) => h.includes("JetBrains+Mono"))).toBe(true);
    });
  });
});   
