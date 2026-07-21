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
  global.fetch = jest.fn((url: string) => {
      if (url.includes("/api/admin")) {
        return Promise.resolve({
          json: () => Promise.resolve({ 
            data: [{ 
              buildingId: "b1", 
              buildingName: "Building-123 A" 
            }] 
          })
        });
      }
      if (url.includes("role=viewers")) {
        return Promise.resolve({
          json: () => Promise.resolve({ data: [{ 
              userId: "u1", firstName: "Alice", 
              email: "alice@test.com", 
              roleType: "VIEWER", 
              buildingIds: [] 
            }] 
          })
        });
      }
      if (url.includes("role=managers")) {
        return Promise.resolve({
          json: () => Promise.resolve({ 
            data: [{ 
              userId: "m1", 
              firstName: "Bob", 
              email: "bob@test.com", 
              roleType: "BUILDING_MANAGER", 
              buildingIds: [] 
            }] 
          })
        });
      }
      return Promise.resolve({ json: () => 
        Promise.resolve([]) 
      });
    }) as jest.Mock;
});

afterEach(() => jest.restoreAllMocks());

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

    it("renders Assign buttons", async () => {
      render(<UserManagementPage />);
      const assignButtons = await screen.findAllByRole("button", { name: /^assign$/i });
      expect(assignButtons.length).toBeGreaterThan(0);
    });
  });
});