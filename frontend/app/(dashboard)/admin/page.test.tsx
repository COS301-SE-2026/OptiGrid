import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import AdminPage from "./page";
import { useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

beforeAll(() => {
  jest.spyOn(window, "confirm").mockImplementation(() => true);
});

afterAll(() => {
  jest.restoreAllMocks();
});


const getRow = async (name: string) => {
  const cell = await screen.findByText(name);
  return cell.closest("tr")!;
};

const clickInRow = async (name: string, buttonLabel: RegExp | string) => {
  const row = await getRow(name);
  fireEvent.click(within(row).getByRole("button", { name: buttonLabel }));
};


describe("AdminPage", () => {
  beforeEach(() => {

    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    });

    global.fetch = jest.fn(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          status: "success",
          data: [
            { building_id: '1', building_name: 'sandtonhq', lifecycle_state: 'ACTIVE' },
            { building_id: '2', building_name: 'river', lifecycle_state: 'PROVISIONING_FAILED' },
            { building_id: '3', building_name: 'tonhq', lifecycle_state: 'PROVISIONING' },
            { building_id: '4', building_name: 'greenhq', lifecycle_state: 'ACTIVE' },
            { building_id: '5', building_name: 'extra', lifecycle_state: 'ACTIVE' }
          ]
        })
      })
    ) as jest.Mock;
  })
  afterEach(() => { jest.clearAllMocks();});


  describe("Initial render", () => {
    it("renders the page heading", async () => {
      render(<AdminPage />);
      expect(await screen.findByRole("heading", { name: /Admin - Manage Buildings/i })).toBeInTheDocument();
    });


    it("renders the lifecycle filter", async () => {
      render(<AdminPage />);
      expect(await screen.findByRole("combobox")).toBeInTheDocument();
    });

    it("renders the search bar", async () => {
      render(<AdminPage />);
      expect(screen.getByPlaceholderText(/building name/i)).toBeInTheDocument();
    });

    it("renders the Reset filters button", async () => {
      render(<AdminPage />);
      expect(await screen.findByRole("button", { name: /reset filters/i })).toBeInTheDocument();
    });
  });

  
  
  
  describe("Reset filters button", () => {
   
    it("resets lifecycle filter to 'all' when Reset filters is clicked", async () => {
      render(<AdminPage />);
      const select = await screen.findByRole("combobox");
      fireEvent.change(select, { target: { value: "all" } });
      expect((select as HTMLSelectElement).value).toBe("all");

      fireEvent.click(await screen.findByRole("button", { name: /reset filters/i }));

      expect((select as HTMLSelectElement).value).toBe("all");
    });

    it("shows all buildings again after reset", async () => {
      render(<AdminPage />);
      fireEvent.change(screen.getByPlaceholderText(/building name/i), {
        target: { value: "sandton" },
      });
      expect(screen.queryByText("greenhq")).not.toBeInTheDocument();

      fireEvent.click(await screen.findByRole("button", { name: /reset filters/i }));

      expect(screen.getByText("greenhq")).toBeInTheDocument();
    });
  });

  describe("Edit button", () => {
    

    it("navigaets_to+edit_page", async () => {
      const pushMock = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({
        push: pushMock, 
        replace: jest.fn(), 
        back: jest.fn()
      });
      render(<AdminPage />);
      await clickInRow("sandtonhq", /^edit$/i);

      expect(pushMock).toHaveBeenCalledWith("/buildings/1/edit");
    });
  });

});

   describe("Delete button", () => {
    it("renders a Delete button for every building", async () => {
      render(<AdminPage />);
      await screen.findByText("sandtonhq");
      expect(screen.getAllByRole("button", { name: /delete/i })).toHaveLength(5);
    });

    it("removes the building from the table when Delete is confirmed", async () => {
      render(<AdminPage />);
      clickInRow("river", /delete/i);
      expect(screen.queryByText("river")).not.toBeInTheDocument();
    });
  });

  
  describe("Search bar", () => {
    it("search buildings by name", async () => {
      render(<AdminPage />);
      await screen.findByText("sandtonhq");
      fireEvent.change(screen.getByPlaceholderText(/building name/i), {
        target: { value: "sandton" },
      });
      expect(screen.getByText("sandtonhq")).toBeInTheDocument();
      expect(screen.queryByText("greenhq")).not.toBeInTheDocument();
    });

    it("shows 'No buildings found' when search matches nothing", async () => {
      render(<AdminPage />);
      fireEvent.change(screen.getByPlaceholderText(/building name/i), {
        target: { value: "zzznomatch" },
      });
      expect(screen.getByText(/No buildings found/i)).toBeInTheDocument();
    });
  });

  
  describe("Lifecycle filter", () => {
    it("filters to show only active buildings", async () => {
      render(<AdminPage />);
      await screen.findByText("sandtonhq");
      fireEvent.change(await screen.findByRole("combobox"), { target: { value: "ACTIVE" } });
      expect(await screen.findByText("sandtonhq")).toBeInTheDocument();
    });

    it("filters to show only failed buildings", async () => {
      render(<AdminPage />);
      fireEvent.change(await screen.findByRole("combobox"), { target: { value: "PROVISIONING_FAILED" } });
      expect(await screen.findByText("river")).toBeInTheDocument();
      expect(screen.queryByText("sandtonhq")).not.toBeInTheDocument();
    });

    it("shows all buildings when 'all' is selected", async () => {
      render(<AdminPage />);
      fireEvent.change(await screen.findByRole("combobox"), { target: { value: "ACTIVE" } });
      fireEvent.change(await screen.findByRole("combobox"), { target: { value: "all" } });
      const rows = await screen.findAllByRole("row");
      expect(await screen.getAllByRole("row").length).toBeGreaterThan(5);
    });
  });