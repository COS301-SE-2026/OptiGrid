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
      expect(screen.getByRole("heading", { name: /Edit and Delete building/i })).toBeInTheDocument();
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

    it("renders the Landing Signup image with correct alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/Sign up page showing the registration form/i)).toBeInTheDocument();
    });

    it("renders the Login Page image with correct alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/Login page showing the login form/i)).toBeInTheDocument();
    });

    it("renders the Dashboard Screenshot image with correct alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/Dashboard overview showing energy consumption metrics and charts/i)).toBeInTheDocument();
    });

    it("renders the Dashboard Add image with correct alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/Add building button on the dashboard/i)).toBeInTheDocument();
    });

    it("renders the Add Building image with correct alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/Building creation form with input fields/i)).toBeInTheDocument();
    });

    it("renders the Edit and Delete image with correct alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/Edit and delete building options/i)).toBeInTheDocument();
    });

    it("renders the Compare image with correct alt", () => {
      render(<UserManualPage />);
      expect(screen.getByAltText(/Compare buildings dashboard view/i)).toBeInTheDocument();
      expect(screen.getByAltText(/Building comparison chart showing energy usage/i)).toBeInTheDocument();
    });



    it("renders the Forecast image with correct alt", () => {
      render(<UserManualPage />);
       expect(screen.getByAltText(/Forecast dashboard showing demand predictions/i)).toBeInTheDocument();
      expect(screen.getByAltText(/Forecast chart showing predicted energy demand/i)).toBeInTheDocument();
      
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