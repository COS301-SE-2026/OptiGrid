import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import EditBuildingPage from "./page";



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
  fireEvent.change(getField(name), { target: { name, value } });

const submitForm = () =>
  fireEvent.submit(document.querySelector("form")!);



describe("EditBuildingPage", () => {

 
  describe("Initial render", () => {
    it("renders the Edit Building heading", () => {
      render(<EditBuildingPage />);
      expect(screen.getByRole("heading", { name: /edit building/i })).toBeInTheDocument();
    });

    it("renders the sub-heading", () => {
      render(<EditBuildingPage />);
      expect(screen.getByText(/update building information/i)).toBeInTheDocument();
    });

    it("renders the Building Name input", () => {
      render(<EditBuildingPage />);
      expect(getField("building_name")).toBeInTheDocument();
    });

    it("renders the Physical Address textarea", () => {
      render(<EditBuildingPage />);
      expect(getField("physical_address")).toBeInTheDocument();
    });

    it("renders the Building Type select", () => {
      render(<EditBuildingPage />);
      expect(getField("building_type")).toBeInTheDocument();
    });

    it("renders the Square Footage input", () => {
      render(<EditBuildingPage />);
      expect(getField("square_footage")).toBeInTheDocument();
    });

    it("renders the Max Occupancy input", () => {
      render(<EditBuildingPage />);
      expect(getField("max_occupancy")).toBeInTheDocument();
    });

    it("renders the Operating Start input", () => {
      render(<EditBuildingPage />);
      expect(getField("operating_start")).toBeInTheDocument();
    });

    it("renders the Operating End input", () => {
      render(<EditBuildingPage />);
      expect(getField("operating_end")).toBeInTheDocument();
    });

    it("renders the Save Changes button", () => {
      render(<EditBuildingPage />);
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    it("renders the Cancel button", () => {
      render(<EditBuildingPage />);
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("Save Changes button is type='submit'", () => {
      render(<EditBuildingPage />);
      expect(screen.getByRole("button", { name: /save changes/i })).toHaveAttribute("type", "submit");
    });

    it("Cancel button is type='button'", () => {
      render(<EditBuildingPage />);
      expect(screen.getByRole("button", { name: /cancel/i })).toHaveAttribute("type", "button");
    });
  });

  
  describe("Pre-filled default values", () => {
    it("pre-fills building name with 'building A'", () => {
      render(<EditBuildingPage />);
      expect((getField("building_name") as HTMLInputElement).value).toBe("building A");
    });

    it("pre-fills physical address", () => {
      render(<EditBuildingPage />);
      expect((getField("physical_address") as HTMLTextAreaElement).value).toBe("123 Street, Pretoria");
    });

    it("pre-fills building type with 'Office'", () => {
      render(<EditBuildingPage />);
      expect((getField("building_type") as HTMLSelectElement).value).toBe("Office");
    });

    it("pre-fills square footage with '2500'", () => {
      render(<EditBuildingPage />);
      expect((getField("square_footage") as HTMLInputElement).value).toBe("2500");
    });

    it("pre-fills max occupancy with '120'", () => {
      render(<EditBuildingPage />);
      expect((getField("max_occupancy") as HTMLInputElement).value).toBe("120");
    });

    it("pre-fills operating start with '08:00'", () => {
      render(<EditBuildingPage />);
      expect((getField("operating_start") as HTMLInputElement).value).toBe("08:00");
    });

    it("pre-fills operating end with '18:00'", () => {
      render(<EditBuildingPage />);
      expect((getField("operating_end") as HTMLInputElement).value).toBe("18:00");
    });
  });

  
  describe("Building Type dropdown", () => {
    it("renders Residential option", () => {
      render(<EditBuildingPage />);
      const select = getField("building_type") as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).toContain("Residential");
    });

    it("renders Office option", () => {
      render(<EditBuildingPage />);
      const select = getField("building_type") as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).toContain("Office");
    });

    it("renders Industrial option", () => {
      render(<EditBuildingPage />);
      const select = getField("building_type") as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).toContain("Industrial");
    });

    it("updates building type when changed", () => {
      render(<EditBuildingPage />);
      fillField("building_type", "Residential");
      expect((getField("building_type") as HTMLSelectElement).value).toBe("Residential");
    });
  });

  
  describe("Form field updates", () => {
    it("updates building name on change", () => {
      render(<EditBuildingPage />);
      fillField("building_name", "Tower B");
      expect((getField("building_name") as HTMLInputElement).value).toBe("Tower B");
    });

    it("updates physical address on change", () => {
      render(<EditBuildingPage />);
      fillField("physical_address", "456 New Ave");
      expect((getField("physical_address") as HTMLTextAreaElement).value).toBe("456 New Ave");
    });

    it("updates square footage on change", () => {
      render(<EditBuildingPage />);
      fillField("square_footage", "9999");
      expect((getField("square_footage") as HTMLInputElement).value).toBe("9999");
    });

    it("updates max occupancy on change", () => {
      render(<EditBuildingPage />);
      fillField("max_occupancy", "300");
      expect((getField("max_occupancy") as HTMLInputElement).value).toBe("300");
    });

    it("updates operating start on change", () => {
      render(<EditBuildingPage />);
      fillField("operating_start", "09:00");
      expect((getField("operating_start") as HTMLInputElement).value).toBe("09:00");
    });

    it("updates operating end on change", () => {
      render(<EditBuildingPage />);
      fillField("operating_end", "20:00");
      expect((getField("operating_end") as HTMLInputElement).value).toBe("20:00");
    });
  });

  
  describe("Form submission", () => {
    it("calls alert with success message on submit", () => {
      render(<EditBuildingPage />);
      submitForm();
      expect(window.alert).toHaveBeenCalledWith("Building updated successfully!");
    });

    it("logs updated building data on submit", () => {
      render(<EditBuildingPage />);
      submitForm();
      expect(console.log).toHaveBeenCalledWith(
        "Updated Building:",
        expect.objectContaining({
          building_name: "building A",
          building_type: "Office",
          physical_address: "123 Street, Pretoria",
          square_footage: "2500",
          max_occupancy: "120",
          operating_hours: { start: "08:00", end: "18:00" },
        })
      );
    });

    it("logs updated data with modified fields", () => {
      render(<EditBuildingPage />);
      fillField("building_name", "Tower B");
      fillField("square_footage", "9999");
      fillField("operating_start", "07:00");

      submitForm();

      expect(console.log).toHaveBeenCalledWith(
        "Updated Building:",
        expect.objectContaining({
          building_name: "Tower B",
          square_footage: "9999",
          operating_hours: { start: "07:00", end: "18:00" },
        })
      );
    });
  });

  
  describe("Font loading", () => {
    it("appends Inter font link on mount", () => {
      render(<EditBuildingPage />);
      const links = Array.from(document.head.querySelectorAll("link[rel='stylesheet']"));
      const hrefs = links.map((l) => (l as HTMLLinkElement).href);
      expect(hrefs.some((h) => h.includes("Inter"))).toBe(true);
    });

    it("appends Space Grotesk font link on mount", () => {
      render(<EditBuildingPage />);
      const links = Array.from(document.head.querySelectorAll("link[rel='stylesheet']"));
      const hrefs = links.map((l) => (l as HTMLLinkElement).href);
      expect(hrefs.some((h) => h.includes("Space+Grotesk"))).toBe(true);
    });
  });
});