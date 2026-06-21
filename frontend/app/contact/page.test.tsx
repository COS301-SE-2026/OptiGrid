import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ContactUs from "./page";



beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(window, "alert").mockImplementation(() => {});
  (globalThis as typeof globalThis & { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  } as Response);
});

afterEach(() => {
  jest.restoreAllMocks();
});


const getSelect = () => screen.getByRole("combobox");
const getSubject = () => screen.getByPlaceholderText(/enter a subject/i);
const getDescription = () => screen.getByPlaceholderText(/describe your inquiry/i);
const submitForm = () => fireEvent.submit(document.querySelector("form")!);



describe("ContactUs", () => {

  describe("Initial render", () => {
    it("renders the Contact Us heading", () => {
      render(<ContactUs />);
      expect(screen.getByRole("heading", { name: /contact us/i })).toBeInTheDocument();
    });

    it("renders the inquiry description text", () => {
      render(<ContactUs />);
      expect(screen.getByText(/please provide details about your inquiry/i)).toBeInTheDocument();
    });

    it("renders the Inquiry Type select", () => {
      render(<ContactUs />);
      expect(getSelect()).toBeInTheDocument();
    });

    it("renders the Subject input", () => {
      render(<ContactUs />);
      expect(getSubject()).toBeInTheDocument();
    });

    it("renders the Description textarea", () => {
      render(<ContactUs />);
      expect(getDescription()).toBeInTheDocument();
    });

    it("renders the Submit button", () => {
      render(<ContactUs />);
      expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
    });

    it("Submit button is type='submit'", () => {
      render(<ContactUs />);
      expect(screen.getByRole("button", { name: /submit/i })).toHaveAttribute("type", "submit");
    });

    it("does not show success message before submit", () => {
      render(<ContactUs />);
      expect(screen.queryByText(/your inquiry has been submitted successfully/i)).not.toBeInTheDocument();
    });
  });

  describe("Inquiry Type dropdown", () => {
    it("has a default empty placeholder option", () => {
      render(<ContactUs />);
      expect((getSelect() as HTMLSelectElement).value).toBe("");
    });

    it("renders General Inquiry option", () => {
      render(<ContactUs />);
      expect(screen.getByRole("option", { name: /general inquiry/i })).toBeInTheDocument();
    });

    it("renders Technical Support option", () => {
      render(<ContactUs />);
      expect(screen.getByRole("option", { name: /technical support/i })).toBeInTheDocument();
    });

    it("renders Billing and Payments option", () => {
      render(<ContactUs />);
      expect(screen.getByRole("option", { name: /billing & payments/i })).toBeInTheDocument();
    });

    it("updates inquiry type when changed", () => {
      render(<ContactUs />);
      fireEvent.change(getSelect(), { target: { value: "Technical Support" } });
      expect((getSelect() as HTMLSelectElement).value).toBe("Technical Support");
    });
  });

  describe("Form field updates", () => {
    it("updates subject on change", () => {
      render(<ContactUs />);
      fireEvent.change(getSubject(), { target: { value: "Login issue" } });
      expect((getSubject() as HTMLInputElement).value).toBe("Login issue");
    });

    it("updates description on change", () => {
      render(<ContactUs />);
      fireEvent.change(getDescription(), { target: { value: "unable to login" } });
      expect((getDescription() as HTMLTextAreaElement).value).toBe("unable to login");
    });
  });

  describe("Form submission", () => {
    it("sends inquiry data to the contact API", async () => {
      render(<ContactUs />);
      fireEvent.change(getSelect(), { target: { value: "General Inquiry" } });
      fireEvent.change(getSubject(), { target: { value: "subject" } });
      fireEvent.change(getDescription(), { target: { value: "description" } });

      submitForm();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/contact",
          expect.objectContaining({
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inquiryType: "General Inquiry",
              subject: "subject",
              message: "description",
            }),
          }),
        );
      });
    });

    it("logs inquiry data to console on submit", async ()  => {
      render(<ContactUs />);
      fireEvent.change(getSelect(), { target: { value: "Technical Support" } });
      fireEvent.change(getSubject(), { target: { value: "subject" } });
      fireEvent.change(getDescription(), { target: { value: "description" } });

      submitForm();

      await waitFor(() => {expect(screen.getByText(/your inquiry has been submitted successfully/i)).toBeInTheDocument();});
    });

    it("resets inquiry type to empty after submit", async () => {
      render(<ContactUs />);
      fireEvent.change(getSelect(), { target: { value: "General Inquiry" } });
      fireEvent.change(getSubject(), { target: { value: "Test" } });
      fireEvent.change(getDescription(), { target: { value: "Test description" } });

      submitForm();
      await waitFor(() => {expect((getSelect() as HTMLSelectElement).value).toBe("");});
    });

    it("resets subject to empty after submit", async () => {
      render(<ContactUs />);
      fireEvent.change(getSelect(), { target: { value: "General Inquiry" } });
      fireEvent.change(getSubject(), { target: { value: "Test" } });
      fireEvent.change(getDescription(), { target: { value: "Test description" } });

      submitForm();
      await waitFor(() => {expect((getSubject() as HTMLInputElement).value).toBe("");});
    });

    it("resets description to empty after submit", async () => {
      render(<ContactUs />);
      fireEvent.change(getSelect(), { target: { value: "General Inquiry" } });
      fireEvent.change(getSubject(), { target: { value: "Test" } });
      fireEvent.change(getDescription(), { target: { value: "Test description" } });

      submitForm();
      await waitFor(() => {expect((getDescription() as HTMLTextAreaElement).value).toBe("");});
    });
  });

  describe("Business hours", () => {
    it("renders the Operating Hours heading", () => {
      render(<ContactUs />);
      expect(screen.getByRole("heading", { name: /operating hours/i })).toBeInTheDocument();
    });

    it("renders Monday - Friday hours", () => {
      render(<ContactUs />);
      expect(screen.getByText(/monday - friday.*08:00.*17:00/i)).toBeInTheDocument();
    });

    it("renders Saturday hours", () => {
      render(<ContactUs />);
      expect(screen.getByText(/saturday/i)).toBeInTheDocument();
    });

    it("renders Sunday as Closed", () => {
      render(<ContactUs />);
      expect(screen.getByText(/sunday.*closed/i)).toBeInTheDocument();
    });
  });

  

});