
import React from "react";
import { render, screen} from "@testing-library/react";
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
 
 
const getSelects = () => screen.getAllByRole("combobox");
const getRoleSelect = () => getSelects()[0];
const getSortSelect = () => getSelects()[1];
const getSearchInput = () => screen.getByPlaceholderText(/name or email/i);
 
 
describe("UserManagementPage", () => {
 
 
  describe("Initial render", () => {
    it("renders the heading", () => {
      render(<UserManagementPage />);
      expect(screen.getByRole("heading", { name: /user management/i })).toBeInTheDocument();
    });
 
    it("renders the users table", () => {
      render(<UserManagementPage />);
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
 
    it("renders the role filter", () => {
      render(<UserManagementPage />);
      expect(getRoleSelect()).toBeInTheDocument();
    });
 
    it("renders the sort filter", () => {
      render(<UserManagementPage />);
      expect(getSortSelect()).toBeInTheDocument();
    });
 
    it("renders the search", () => {
      render(<UserManagementPage />);
      expect(getSearchInput()).toBeInTheDocument();
    });
 
    it("renders the Reset button", () => {
      render(<UserManagementPage />);
      expect(screen.getByRole("button", { name: /^reset$/i })).toBeInTheDocument();
    });
 
    it("renders the Assign Building to Manager", () => {
      render(<UserManagementPage />);
      expect(screen.getByRole("heading", { name: /assign building to manager/i })).toBeInTheDocument();
    });
 
    it("renders the Assign Building button", () => {
      render(<UserManagementPage />);
      expect(screen.getByRole("button", { name: /assign building/i })).toBeInTheDocument();
    });


  });
});