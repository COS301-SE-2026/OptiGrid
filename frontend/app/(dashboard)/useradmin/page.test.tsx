import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import UserManagementPage from "./page";

beforeAll(() => {
  jest.spyOn(window, "confirm").mockImplementation(() => true);
  jest.useFakeTimers();
});

afterAll(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  (window.confirm as jest.Mock).mockImplementation(() => true);
});

const getSortSelect = () => screen.getByRole("combobox");
const getSearchInput = () => screen.getByPlaceholderText(/name or email/i);

describe("UserManagementPage", () => {
  describe("Initial render", () => {
    it("renders the heading", () => {
      render(<UserManagementPage />);
      expect(
        screen.getByRole("heading", {
          name: /user management/i,
        })
      ).toBeInTheDocument();
    });

    it("renders the users table", () => {
      render(<UserManagementPage />);
      expect(screen.getAllByRole("table")).toHaveLength(2);
    });

    it("renders the sort filter", () => {
      render(<UserManagementPage />);
      expect(getSortSelect()).toBeInTheDocument();
    });

    it("renders the search input", () => {
      render(<UserManagementPage />);
      expect(getSearchInput()).toBeInTheDocument();
    });

    it("renders the Reset button", () => {
      render(<UserManagementPage />);
      expect(
        screen.getByRole("button", { name: /^reset$/i })
      ).toBeInTheDocument();
    });

    it("renders the Users heading", () => {
      render(<UserManagementPage />);
      expect(
        screen.getByRole("heading", { name: /users/i })
      ).toBeInTheDocument();
    });

    it("renders the Managers heading", () => {
      render(<UserManagementPage />);
      expect(
        screen.getByRole("heading", { name: /managers/i })
      ).toBeInTheDocument();
    });

    it("renders Assign buttons", () => {
      render(<UserManagementPage />);
      expect(
        screen.getAllByRole("button", { name: /^assign$/i }).length
      ).toBeGreaterThan(0);
    });
  });
});