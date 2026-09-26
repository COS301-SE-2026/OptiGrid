import React from "react";
import { render, screen, fireEvent,  act } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddBuildingPage from "./page";

const mockPush = jest.fn();
 
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
 
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));


const getField = (id: string) => document.getElementById(id) as HTMLElement;
 
const fill = (id: string, value: string) =>
  fireEvent.change(getField(id), { target: { name: id, value } });
 
const submitForm = () => fireEvent.submit(document.querySelector("form")!);
 
const fillRequired = () => fill("building_name", "building A");


const mockFetchOk = () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "111" }),
  });
};
 

 
describe("AddBuildingPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });


   describe("Initial render", () => {
    it("renders the page title", () => {
      render(<AddBuildingPage />);
      expect(screen.getByRole("heading", { name: /add building/i })).toBeInTheDocument();
    });


    it("renders the subtitle", () => {
      render(<AddBuildingPage />);
      expect(screen.getByText(/register a new building/i)).toBeInTheDocument();
    });


    it("renders the building name input", () => {
      render(<AddBuildingPage />);
      expect(getField("building_name")).toBeInTheDocument();
    });

    it("renders the building type select", () => {
      render(<AddBuildingPage />);
      expect(getField("building_type")).toBeInTheDocument();
    });

    it("renders the physical address input", () => {
      render(<AddBuildingPage />);
      expect(getField("physical_address")).toBeInTheDocument();
    });
 
    it("renders the square footage input", () => {
      render(<AddBuildingPage />);
      expect(getField("square_footage")).toBeInTheDocument();
    });
 
    it("renders the max occupancy input", () => {
      render(<AddBuildingPage />);
      expect(getField("max_occupancy")).toBeInTheDocument();
    });


    it("renders the timezone input", () => {
      render(<AddBuildingPage />);
      expect(getField("timezone")).toBeInTheDocument();
    });
 
    it("renders the geohash input", () => {
      render(<AddBuildingPage />);
      expect(getField("geohash")).toBeInTheDocument();
    });
 
    it("renders the latitude input", () => {
      render(<AddBuildingPage />);
      expect(getField("latitude")).toBeInTheDocument();
    });
 
    it("renders the longitude input", () => {
      render(<AddBuildingPage />);
      expect(getField("longitude")).toBeInTheDocument();
    });
 
    it("renders the submit button", () => {
      render(<AddBuildingPage />);
      expect(screen.getByRole("button", { name: /add building/i })).toBeInTheDocument();
    });

    it("defaults building type to 'Commercial'", () => {
      render(<AddBuildingPage />);
      expect((getField("building_type") as HTMLSelectElement).value).toBe("Commercial");
    });

    it("leaves the timezone field empty with 'Africa/Johannesburg' shown as a placeholder", () => {
      render(<AddBuildingPage />);
      const timezoneField = getField("timezone") as HTMLInputElement;
      
      expect(timezoneField.value).toBe("");
      expect(timezoneField.placeholder).toBe("Africa/Johannesburg");
    });


      describe("Building type dropdown", () => {
    const types = [
      "Residential", "Commercial", "Industrial", "Healthcare",
      "Construction", "Mixed use", "Shopping centre", "Other",
    ];
 
    types.forEach((type) => {
      it(`renders the ${type} option`, () => {
        render(<AddBuildingPage />);
        const select = getField("building_type") as HTMLSelectElement;
        const values = Array.from(select.options).map((o) => o.text);
        expect(values.some((v) => v.toLowerCase() === type.toLowerCase())).toBe(true);
      });
    });

    it("updates building type when changed", () => {
      render(<AddBuildingPage />);
      fill("building_type", "Industrial");
      expect((getField("building_type") as HTMLSelectElement).value).toBe("Industrial");
    });
  });


  describe("Form field updates", () => {
    it("updates building name on change", () => {
      render(<AddBuildingPage />);
      fill("building_name", "building A");
      expect((getField("building_name") as HTMLInputElement).value).toBe("building A");
    });


    it("updates physical address on change", () => {
      render(<AddBuildingPage />);
      fill("physical_address", "1 Main St, Johannesburg");
      expect((getField("physical_address") as HTMLInputElement).value).toBe("1 Main St, Johannesburg");
    });

    it("updates square footage on change", () => {
      render(<AddBuildingPage />);
      fill("square_footage", "5000");
      expect((getField("square_footage") as HTMLInputElement).value).toBe("5000");
    });

    it("updates max occupancy on change", () => {
      render(<AddBuildingPage />);
      fill("max_occupancy", "200");
      expect((getField("max_occupancy") as HTMLInputElement).value).toBe("200");
    });


    it("updates timezone on change", () => {
      render(<AddBuildingPage />);
      fill("timezone", "UTC");
      expect((getField("timezone") as HTMLInputElement).value).toBe("UTC");
    });

    it("updates geohash on change", () => {
      render(<AddBuildingPage />);
      fill("geohash", "kgesj5h");
      expect((getField("geohash") as HTMLInputElement).value).toBe("kgesj5h");
    });
 
    it("updates latitude on change", () => {
      render(<AddBuildingPage />);
      fill("latitude", "-26.111");
      expect((getField("latitude") as HTMLInputElement).value).toBe("-26.111");
    });
 
    it("updates longitude on change", () => {
      render(<AddBuildingPage />);
      fill("longitude", "44.66");
      expect((getField("longitude") as HTMLInputElement).value).toBe("44.66");
    });
  });


  describe("Validation", () => {
    it("shows error when building name is empty on submit", () => {
      render(<AddBuildingPage />);
      submitForm();
      expect(screen.getByText(/building name is required/i)).toBeInTheDocument();
    });
 
    it("shows error when building name is only 1 character", () => {
      render(<AddBuildingPage />);
      fill("building_name", "A");
      submitForm();
      expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
    });
 
    it("shows error when address is less than 5 characters", () => {
      render(<AddBuildingPage />);
      fill("building_name", "building A");
      fill("physical_address", "111");
      submitForm();
      expect(screen.getByText(/address must be at least 5 characters/i)).toBeInTheDocument();
    });

    it("shows error when floor area is negative", () => {
      render(<AddBuildingPage />);
      fill("building_name", "building A");
      fill("square_footage", "-100");
      submitForm();
      expect(screen.getByText(/floor area must be a positive number/i)).toBeInTheDocument();
    });

    it("rejects a floor count that is not a whole number", () => {
      render(<AddBuildingPage />);
      fillRequired();
      fill("floors_above_ground", "2.5");
      submitForm();
      expect(screen.getByText(/floors must be a whole number/i)).toBeInTheDocument();
    });

    it("rejects a geohash that is too short", () => {
      render(<AddBuildingPage />);
      fillRequired();
      fill("geohash", "kg");
      submitForm();
      expect(screen.getByText(/geohash must be 5 to 10 characters/i)).toBeInTheDocument();
    });

    it("sends the size, supply and location details with the new building", async () => {
      mockFetchOk();
      render(<AddBuildingPage />);
      fillRequired();
      fill("floors_above_ground", "6");
      fill("solar_capacity_kw", "40");
      fill("max_current_threshold", "80");
      fill("latitude", "-26.1");
      fill("longitude", "28.05");
      await act(async () => { submitForm(); });

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse(options.body)).toMatchObject({
        building_name: "building A",
        floors_above_ground: 6,
        solar_capacity_kw: 40,
        max_current_threshold: 80,
        latitude: -26.1,
        longitude: 28.05,
        nominal_voltage: 230,
      });
    });
 

    it("does not show error when all required fields are valid", async () => {
      mockFetchOk();
      render(<AddBuildingPage />);
      fillRequired();
      await act(async () => { submitForm(); });
      expect(screen.queryByText(/building name is required/i)).not.toBeInTheDocument();
    });
  });

   });
});

   