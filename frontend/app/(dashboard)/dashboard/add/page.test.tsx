import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddBuildingPage from "./page";


global.FormData = class MockFormData {
  private map: Record<string, string> = {};

  constructor(form?: HTMLFormElement) {
    if (form) {
      form
        .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          "input[name], select[name], textarea[name]"
        )
        .forEach((el) => {
          this.map[el.name] = el.value;
        });
    }
  }

  get(key: string): string | null {
    return this.map[key] ?? null;
  }
} as unknown as typeof FormData;


beforeAll(() => {
  jest.spyOn(window, "alert").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});



const getField = (name: string) =>
  document.querySelector(`[name="${name}"]`) as HTMLElement;

const fillField = (name: string, value: string) =>
  fireEvent.change(getField(name), { target: { value } });

const submitForm = () =>
  fireEvent.submit(document.querySelector("form")!);


describe("AddBuildingPage", () => {

  describe("Initial render", () => {
    it("renders the Create Building heading", () => {
      render(<AddBuildingPage />);
      expect(screen.getByRole("heading", { name: /create building/i })).toBeInTheDocument();
    });

    it("renders the sub-heading", () => {
      render(<AddBuildingPage />);
      expect(screen.getByText(/add a new building/i)).toBeInTheDocument();
    });

    it("renders the Building Name input", () => {
      render(<AddBuildingPage />);
      expect(getField("building_name")).toBeInTheDocument();
    });

    it("renders the Address textarea", () => {
      render(<AddBuildingPage />);
      expect(getField("physical_address")).toBeInTheDocument();
    });

    it("renders the Building Type select", () => {
      render(<AddBuildingPage />);
      expect(getField("building_type")).toBeInTheDocument();
    });

    it("renders the Square Footage input", () => {
      render(<AddBuildingPage />);
      expect(getField("square_footage")).toBeInTheDocument();
    });

    it("renders the Number of Occupants input", () => {
      render(<AddBuildingPage />);
      expect(getField("max_occupancy")).toBeInTheDocument();
    });

    it("renders the submit button", () => {
      render(<AddBuildingPage />);
      expect(screen.getByRole("button", { name: /create building/i })).toBeInTheDocument();
    });

    it("submit button is type='submit'", () => {
      render(<AddBuildingPage />);
      expect(screen.getByRole("button", { name: /create building/i })).toHaveAttribute("type", "submit");
    });
  });

  describe("Building Type dropdown", () => {
    it("renders all three building type options", () => {
      render(<AddBuildingPage />);
      const select = getField("building_type") as HTMLSelectElement;
      const options = Array.from(select.options).map((o) => o.value);
      expect(options).toContain("Office");
      expect(options).toContain("Residential");
      expect(options).toContain("Industrial");
    });

    it("has a default empty 'Select type' placeholder option", () => {
      render(<AddBuildingPage />);
      const select = getField("building_type") as HTMLSelectElement;
      expect(select.options[0].text).toMatch(/select type/i);
      expect(select.options[0].value).toBe("");
    });

    it("updates value when a type is selected", () => {
      render(<AddBuildingPage />);
      fireEvent.change(getField("building_type"), { target: { value: "Office" } });
      expect((getField("building_type") as HTMLSelectElement).value).toBe("Office");
    });
  });

  describe("Operating Hours", () => {
    it("defaults start time to 08:00", () => {
      render(<AddBuildingPage />);
      const startInput = document.querySelector('input[placeholder="08:00"]') as HTMLInputElement;
      expect(startInput).toBeInTheDocument();
      expect(startInput.value).toBe("08:00");
    });

    it("defaults end time to 18:00", () => {
      render(<AddBuildingPage />);
      const endInput = document.querySelector('input[placeholder="18:00"]') as HTMLInputElement;
      expect(endInput).toBeInTheDocument();
      expect(endInput.value).toBe("18:00");
    });

    it("updates start time on change", () => {
      render(<AddBuildingPage />);
      const startInput = document.querySelector('input[placeholder="08:00"]') as HTMLInputElement;
      fireEvent.change(startInput, { target: { value: "09:00" } });
      expect(startInput.value).toBe("09:00");
    });

    it("updates end time on change", () => {
      render(<AddBuildingPage />);
      const endInput = document.querySelector('input[placeholder="18:00"]') as HTMLInputElement;
      fireEvent.change(endInput, { target: { value: "20:00" } });
      expect(endInput.value).toBe("20:00");
    });
  });

  describe("Form field updates", () => {
    it("updates building name on change", () => {
      render(<AddBuildingPage />);
      fillField("building_name", "building A");
      expect((getField("building_name") as HTMLInputElement).value).toBe("building A");
    });

    it("updates address on change", () => {
      render(<AddBuildingPage />);
      fillField("physical_address", "123 build");
      expect((getField("physical_address") as HTMLTextAreaElement).value).toBe("123 build");
    });

    it("updates square footage on change", () => {
      render(<AddBuildingPage />);
      fillField("square_footage", "5000");
      expect((getField("square_footage") as HTMLInputElement).value).toBe("5000");
    });

    it("updates max occupancy on change", () => {
      render(<AddBuildingPage />);
      fillField("max_occupancy", "200");
      expect((getField("max_occupancy") as HTMLInputElement).value).toBe("200");
    });
  });

  describe("Form submission", () => {
    it("calls alert with success message on submit", () => {
      render(<AddBuildingPage />);
      fillField("building_name", "building A");
      fillField("physical_address", "123 build");
      fireEvent.change(getField("building_type"), { target: { value: "Office" } });
      fillField("square_footage", "5000");
      fillField("max_occupancy", "200");

      submitForm();

      expect(window.alert).toHaveBeenCalledWith("Building created successfully");
    });

    it("logs building data to console on submit", () => {
      render(<AddBuildingPage />);
      fillField("building_name", "building A");
      fillField("physical_address", "123 build");
      fireEvent.change(getField("building_type"), { target: { value: "Office" } });
      fillField("square_footage", "5000");
      fillField("max_occupancy", "200");

      submitForm();

      expect(console.log).toHaveBeenCalledWith(
        "Building Data:",
        expect.objectContaining({
          building_name: "building A",
          physical_address: "123 build",
          building_type: "Office",
          square_footage: "5000",
          max_occupancy: "200",
          operatingHours: { start: "08:00", end: "18:00" },
        })
      );
    });

    it("resets the form after successful submission", () => {
      render(<AddBuildingPage />);
      fillField("building_name", "building A");
      fillField("physical_address", "123 build");

      submitForm();

      expect((getField("building_name") as HTMLInputElement).value).toBe("");
      expect((getField("physical_address") as HTMLTextAreaElement).value).toBe("");
    });
  });

  describe("Font loading", () => {
    it("appends Google Font link tags on mount", () => {
      render(<AddBuildingPage />);
      const links = Array.from(document.head.querySelectorAll("link[rel='stylesheet']"));
      const hrefs = links.map((l) => (l as HTMLLinkElement).href);
      expect(hrefs.some((h) => h.includes("Inter"))).toBe(true);
      expect(hrefs.some((h) => h.includes("Space+Grotesk"))).toBe(true);
    });
  });
});