import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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
  global.fetch = jest.fn(
    async (input: RequestInfo | URL): Promise<Response> => {
      const url = input.toString();

      if (url.includes("/api/admin")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                buildingId: "b1",
                buildingName: "Building-123 A",
              },
            ],
          }),
        } as Response;
      }

      if (url.includes("role=viewers")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                userId: "u1",
                firstName: "Alice",
                email: "alice@test.com",
                roleType: "VIEWER",
                buildingIds: [],
              },
            ],
          }),
        } as Response;
      }

      if (url.includes("role=managers")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                userId: "m1",
                firstName: "Bob",
                email: "bob@test.com",
                roleType: "BUILDING_MANAGER",
                buildingIds: [],
              },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [],
        }),
      } as Response;
    }
  ) as jest.Mock;
});

afterEach(() => {
  jest.clearAllMocks();
});

const getSelects = () => screen.getAllByRole("combobox");
const getSortSelect = () => screen.getByRole("combobox");
const getSearchInput = () =>
  screen.getByPlaceholderText(/name or email/i);

describe("UserManagementPage", () => {
  describe("Initial render", () => {
    it("renders the heading", async () => {
      render(<UserManagementPage />);

      expect(
        await screen.findByRole("heading", {
          name: /user management/i,
        })
      ).toBeInTheDocument();
    });

    it("renders the users table", async () => {
      render(<UserManagementPage />);

      expect(await screen.findAllByRole("table")).toHaveLength(2);
    });

    it("renders the sort filter", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      expect(getSortSelect()).toBeInTheDocument();
    });

    it("renders the search input", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      expect(getSearchInput()).toBeInTheDocument();
    });

    it("renders the Reset button", async () => {
      render(<UserManagementPage />);

      expect(
        await screen.findByRole("button", {
          name: /^reset$/i,
        })
      ).toBeInTheDocument();
    });

    it("renders the Users heading", async () => {
      render(<UserManagementPage />);

      expect(
        await screen.findByRole("heading", {
          name: /users/i,
        })
      ).toBeInTheDocument();
    });

    it("renders the Managers heading", async () => {
      render(<UserManagementPage />);

      expect(
        await screen.findByRole("heading", {
          name: /managers/i,
        })
      ).toBeInTheDocument();
    });

    it("renders Assign buttons", async () => {
      render(<UserManagementPage />);

      const assignButtons = await screen.findAllByRole("button", {
        name: /^assign$/i,
      });

      expect(assignButtons.length).toBeGreaterThan(0);
    });
  });

  describe("Search input", () => {
    it("searches users by name", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      fireEvent.change(getSearchInput(), {
        target: { value: "Alice" },
      });

      expect(await screen.findByText("Alice")).toBeInTheDocument();
    });

    it("searches users by email", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      fireEvent.change(getSearchInput(), {
        target: { value: "alice@test.com" },
      });

      expect(
        await screen.findByText("alice@test.com")
      ).toBeInTheDocument();
    });

    it("shows No users when nothing matches", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      fireEvent.change(getSearchInput(), {
        target: { value: "nomatch" },
      });

      expect(
        await screen.findByText(/no users match your filters/i)
      ).toBeInTheDocument();
    });
  });

  describe("Sort filter select", () => {
    it("has Latest Added as default", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      expect(
        (getSortSelect() as HTMLSelectElement).value
      ).toBe("latest");
    });

    it("changes to Oldest Added", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      fireEvent.change(getSortSelect(), {
        target: { value: "oldest" },
      });

      expect(
        (getSortSelect() as HTMLSelectElement).value
      ).toBe("oldest");
    });

    it("changes to Name A-Z", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      fireEvent.change(getSortSelect(), {
        target: { value: "name_asc" },
      });

      expect(
        (getSortSelect() as HTMLSelectElement).value
      ).toBe("name_asc");
    });

    it("changes to Name Z-A", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      fireEvent.change(getSortSelect(), {
        target: { value: "name_desc" },
      });

      expect(
        (getSortSelect() as HTMLSelectElement).value
      ).toBe("name_desc");
    });
  });

  describe("Reset button", () => {
    it("resets sort filter to 'latest'", () => {
      render(<UserManagementPage />);
      fireEvent.change(getSortSelect(), { target: { value: "oldest" } });
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect((getSortSelect() as HTMLSelectElement).value).toBe("latest");
    });

    it("clears search query", () => {
      render(<UserManagementPage />);
      fireEvent.change(getSearchInput(), { target: { value: "Alice" } });
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect((getSearchInput() as HTMLInputElement).value).toBe("");
    });
  });

  describe("Filter and search combined", () => {
    it("filters users using search", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      fireEvent.change(
        screen.getByPlaceholderText(/name or email/i),
        {
          target: {
            value: "Alice",
          },
        }
      );

      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });

    it("resets filters", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      const search = screen.getByPlaceholderText(/name or email/i);

      fireEvent.change(search, {
        target: { value: "Alice" },
      });

      fireEvent.click(screen.getByRole("button", { name: /reset/i }));

      expect(search).toHaveValue("");
    });
  });

  describe("Assign modal", () => {
    it("opens Assign modal", async () => {
      render(<UserManagementPage />);

      await screen.findByText("Bob");

      fireEvent.click(
        screen.getByRole("button", {
          name: /^assign$/i,
        })
      );

      expect(
        screen.getByRole("heading", {
          name: /assign building/i,
        })
      ).toBeInTheDocument();
    });
  });

  describe("Data loading", () => {
    it("loads fetched users", async () => {
      render(<UserManagementPage />);

      expect(await screen.findByText("Alice")).toBeInTheDocument();
      expect(await screen.findByText("Bob")).toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("shows empty state when no users exist", async () => {
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === "/api/admin") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      });

      render(<UserManagementPage />);

      expect(
        await screen.findByText(/no users match your filters/i)
      ).toBeInTheDocument();

      expect(
        screen.getByText(/no managers found/i)
      ).toBeInTheDocument();
    });
  });
});