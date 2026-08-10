import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import UserManualPage from "./page";


describe("UserManualPage", () => {

  describe("structure", () => {
    it("renders the page title", () => {
      render(<UserManualPage />);
      expect(screen.getByRole("heading", { name: /optigrid - user manual/i })).toBeInTheDocument();
    });

    it("renders all  section headings (h2)", () => {
      render(<UserManualPage />);
      const headings = screen.getAllByRole("heading", { level: 2 });
      expect(headings).toHaveLength(7);
    });

    it("renders the Introduction section", () => {
      render(<UserManualPage />);
      expect(screen.getByRole("heading", { name: /1\. introduction/i })).toBeInTheDocument();
    });

    it("renders the Login and Signup section", () => {
      render(<UserManualPage />);
      expect(screen.getByRole("heading", { name: /2\. login and signup/i })).toBeInTheDocument();
    });

    it("renders the Dashboard Guide section", () => {
      render(<UserManualPage />);
      expect(screen.getByRole("heading", { name: /3\. dashboard guide/i })).toBeInTheDocument();
    });

    it("renders the Buildings section", () => {
      render(<UserManualPage />);
      expect(screen.getByRole("heading", { name: /4\. buildings/i })).toBeInTheDocument();
    });

    it("renders the Compare Buildings section", () => {
      render(<UserManualPage />);
      expect(screen.getByRole("heading", { name: /5\. compare buildings/i })).toBeInTheDocument();
    });

    it("renders the Energy Demand Forecasting section", () => {
      render(<UserManualPage />);
      expect(screen.getByRole("heading", { name: /6\. energy demand forecasting/i })).toBeInTheDocument();
    });

    it("renders the Support section", () => {
      render(<UserManualPage />);
      expect(screen.getByRole("heading", { name: /7\. support/i })).toBeInTheDocument();
    });
  });

  describe("Introduction", () => {
    it("renders the introduction paragraph", () => {
      render(<UserManualPage />);
      expect(screen.getByText(/centralised, intelligent energy management system/i)).toBeInTheDocument();
    });

    it("lists the 4 key capabilities", () => {
      render(<UserManualPage />);
      expect(screen.getByText(/monitors real-time and historical energy consumption/i)).toBeInTheDocument();
      expect(screen.getByText(/predicts future energy demand/i)).toBeInTheDocument();
      expect(screen.getByText(/detects inefficiencies and abnormal usage patterns/i)).toBeInTheDocument();
      expect(screen.getByText(/recommends optimisation strategies/i)).toBeInTheDocument();
    });
  });

  describe("Buildings section content", () => {
    it("renders the Create Building section", () => {
      render(<UserManualPage />);
      expect(screen.getByRole("heading", { name: /create building/i })).toBeInTheDocument();
    });

    it("renders the Edit and Delete Building section", () => {
      render(<UserManualPage />);
      expect(screen.getByRole("heading", { name: /edit and delete building/i })).toBeInTheDocument();
    });
  });

  describe("Support section content", () => {
    it("renders the support email", () => {
      render(<UserManualPage />)
      expect(screen.getByText(/cos301\.coreflow@gmail\.com/i)).toBeInTheDocument();
    });

    it("renders the response time content", () => {
      render(<UserManualPage />);
      expect(screen.getByText(/24-48 hours/i)).toBeInTheDocument();
    });
  });

  describe("Images", () => {
    it("renders all images", () => {
      render(<UserManualPage />);
      expect(screen.getAllByRole("img")).toHaveLength(10);
    });

    it("renders the Landing Signup image with a descriptive alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/get started free.*circled in red/i)).toBeInTheDocument();
    });

    it("renders the Login Page image with a descriptive alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/side-by-side sign-up and login forms/i)).toBeInTheDocument();
    });

    it("renders the Dashboard Screenshot image with a descriptive alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/optigrid dashboard\. a left menu/i)).toBeInTheDocument();
    });

    it("renders the Dashboard Add image with a descriptive alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/\+ add building.{0,3}button in the top right circled/i)).toBeInTheDocument();
    });

    it("renders the Add Building image with a descriptive alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/add a building.{0,3}form, with fields/i)).toBeInTheDocument();
    });

    it("renders the Edit and Delete image with a descriptive alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/edit \(pencil\) and delete \(bin\) icons/i)).toBeInTheDocument();
    });

    it("renders the Compare Dashboard image with a descriptive alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/compare.{0,3}item in the left menu circled/i)).toBeInTheDocument();
    });

    it("renders the Compare View image with a descriptive alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/building a set to sandton hq/i)).toBeInTheDocument();
    });

    it("renders the Forecast Dashboard image with a descriptive alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/forecast.{0,3}item in the left menu circled/i)).toBeInTheDocument();
    });

    it("renders the Forecast View image with a descriptive alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/run forecast.{0,3}button circled/i)).toBeInTheDocument();
    });

    it("does not use generic placeholder alt text on any image", () => {
      render(<UserManualPage />);
      const images = screen.getAllByRole("img");
      for (const img of images) {
        const alt = img.getAttribute("alt") ?? "";
        expect(alt.trim().length).toBeGreaterThan(15);
      }
    });

    it("every image has a src", () => {
      render(<UserManualPage />);
      const images = screen.getAllByRole("img");
      images.forEach((img) => {
        expect(img).toHaveAttribute("src");
        expect((img as HTMLImageElement).getAttribute("src")).not.toBe("");
      });
    });
  });
});