import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
                building_id: "b1",
                building_name: "Building-123 A",
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
                createdAt: "2026-09-22T08:00:00.000Z",
              },
              {
                userId: "u2",
                firstName: "Charlie",
                email: "charlie@test.com",
                roleType: "VIEWER",
                buildingIds: [],
                createdAt: "2026-09-20T08:00:00.000Z",
              },
              {
                userId: "u3",
                firstName: null,
                email: "nameless@test.com",
                roleType: "VIEWER",
                buildingIds: [],
                createdAt: "2026-09-21T08:00:00.000Z",
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
                createdAt: "2026-09-23T08:00:00.000Z",
              },
              {
                userId: "m2",
                firstName: "Zoe",
                email: "zoe@test.com",
                roleType: "BUILDING_MANAGER",
                buildingIds: [],
                createdAt: "2026-09-19T08:00:00.000Z",
              },
            ],
          }),
        } as Response;
      }

      if (url.includes("role=admins")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                userId: "admin-1",
                firstName: "Tali",
                email: "tali@example.com",
                roleType: "ADMIN",
                buildingIds: [],
                createdAt: "2026-09-18T08:00:00.000Z",
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

const getSortSelect = () => screen.getByRole("combobox", { name: /sort users by/i });
const getSearchInput = () =>
  screen.getByPlaceholderText(/name or email/i);
const getViewerNames = () => {
  const table = screen.getByRole("table", { name: /viewers and their assigned buildings/i });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent?.trim());
};

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

    it.each([
      ["Oldest Added", "oldest"],
      ["Name A-Z", "name_asc"],
      ["Name Z-A", "name_desc"],
    ])("changes to %s", async (_, value) => {
      render(<UserManagementPage />);

      await screen.findByText("Alice");

      fireEvent.change(getSortSelect(), {
        target: { value },
      });

      expect(
        (getSortSelect() as HTMLSelectElement).value
      ).toBe(value);
    });

    it("reports the fetched administrator count", async () => {
      render(<UserManagementPage />);
      await screen.findByText("Alice");

      const adminLabel = screen.getByText("Admins");
      expect(adminLabel.parentElement).toHaveTextContent("1");
    });

    it.each([
      ["name_asc", ["Alice", "Charlie", "nameless@test.com"]],
      ["name_desc", ["nameless@test.com", "Charlie", "Alice"]],
      ["latest", ["Alice", "nameless@test.com", "Charlie"]],
      ["oldest", ["Charlie", "nameless@test.com", "Alice"]],
    ])("orders the displayed rows for %s", async (value, expectedNames) => {
      render(<UserManagementPage />);
      await screen.findByText("Alice");

      fireEvent.change(getSortSelect(), { target: { value } });

      expect(getViewerNames()).toEqual(expectedNames);
    });

    it("uses email as the sortable and searchable name when firstName is null", async () => {
      render(<UserManagementPage />);
      await screen.findAllByText("nameless@test.com");

      fireEvent.change(getSearchInput(), { target: { value: "nameless" } });

      expect(getViewerNames()).toEqual(["nameless@test.com"]);
    });
  });

  describe("Reset button", () => {
    it("resets sort filter to 'latest'", async () => {
      render(<UserManagementPage />);
      await screen.findByText("Alice");
      fireEvent.change(getSortSelect(), { target: { value: "oldest" } });
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect((getSortSelect() as HTMLSelectElement).value).toBe("latest");
    });

    it("clears search query", async () => {
      render(<UserManagementPage />);
      await screen.findByText("Alice");
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
        screen.getAllByRole("button", {
          name: /^assign$/i,
        })[0]
      );

     
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /assign building/i })).toBeInTheDocument();
      });
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
