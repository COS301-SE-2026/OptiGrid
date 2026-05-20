import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import DeleteBuildingPage from "./page";


beforeAll(() => {
  jest.spyOn(window, "alert").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});



const getField = (role: string) =>
  screen.getByRole(role);

const fillField = (value: string) =>
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value },
  });

const clickButton = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));



describe("DeleteBuildingPage", () => {


  describe("Initial render", () => {

    it("renders Delete Building heading", () => {
      render(<DeleteBuildingPage />);
      expect(
        screen.getByRole("heading", { name: /delete building/i })
      ).toBeInTheDocument();
    });

    it("renders warning text", () => {
      render(<DeleteBuildingPage />);
      expect(
        screen.getByText(/permanently removes the building/i)
      ).toBeInTheDocument();
    });

    it("renders confirmation input", () => {
      render(<DeleteBuildingPage />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders Cancel button", () => {
      render(<DeleteBuildingPage />);
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("renders Delete Permanently button", () => {
      render(<DeleteBuildingPage />);
      expect(
        screen.getByRole("button", { name: /delete permanently/i })
      ).toBeInTheDocument();
    });

    it("Delete button is disabled initially", () => {
      render(<DeleteBuildingPage />);
      expect(
        screen.getByRole("button", { name: /delete permanently/i })
      ).toBeDisabled();
    });
  });


  describe("Confirmation validation", () => {

    it("enables delete button when correct building name is typed", () => {
      render(<DeleteBuildingPage />);

      const input = screen.getByRole("textbox");
      const deleteBtn = screen.getByRole("button", {
        name: /delete permanently/i,
      });

      fireEvent.change(input, {
        target: { value: "Sandton HQ" },
      });

      expect(deleteBtn).toBeEnabled();
    });

    it("keeps delete button disabled for incorrect input", () => {
      render(<DeleteBuildingPage />);

      const input = screen.getByRole("textbox");
      const deleteBtn = screen.getByRole("button", {
        name: /delete permanently/i,
      });

      fireEvent.change(input, {
        target: { value: "Wrong Name" },
      });

      expect(deleteBtn).toBeDisabled();
    });

    it("updates input value correctly", () => {
      render(<DeleteBuildingPage />);

      const input = screen.getByRole("textbox");

      fireEvent.change(input, {
        target: { value: "Sandton HQ" },
      });

      expect((input as HTMLInputElement).value).toBe("Sandton HQ");
    });
  });

  describe("Actions", () => {

    it("does not call alert when delete is clicked with wrong input", () => {
      render(<DeleteBuildingPage />);

      const deleteBtn = screen.getByRole("button", {
        name: /delete permanently/i,
      });

      fireEvent.click(deleteBtn);

      expect(window.alert).not.toHaveBeenCalled();
    });

    it("calls alert when delete is confirmed correctly", () => {
      render(<DeleteBuildingPage />);

      const input = screen.getByRole("textbox");
      const deleteBtn = screen.getByRole("button", {
        name: /delete permanently/i,
      });

      fireEvent.change(input, {
        target: { value: "Sandton HQ" },
      });

      fireEvent.click(deleteBtn);

      expect(window.alert).toHaveBeenCalledWith(
        "Building permanently deleted"
      );
    });
  });



  describe("Font loading", () => {

    it("loads Inter font", () => {
      render(<DeleteBuildingPage />);

      const links = Array.from(
        document.head.querySelectorAll("link[rel='stylesheet']")
      );

      const hrefs = links.map((l) => (l as HTMLLinkElement).href);

      expect(hrefs.some((h) => h.includes("Inter"))).toBe(true);
    });

    it("loads Space Grotesk font", () => {
      render(<DeleteBuildingPage />);

      const links = Array.from(
        document.head.querySelectorAll("link[rel='stylesheet']")
      );

      const hrefs = links.map((l) => (l as HTMLLinkElement).href);

      expect(hrefs.some((h) => h.includes("Space+Grotesk"))).toBe(true);
    });
  });
});