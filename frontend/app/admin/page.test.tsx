import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import AdminPage from "./page";



beforeAll(() => {
  jest.spyOn(window, "confirm").mockImplementation(() => true);
});

afterAll(() => {
  jest.restoreAllMocks();
});


const getRow = (name: string) => {
  const cell = screen.getByText(name);
  return cell.closest("tr")!;
};

const clickInRow = (name: string, buttonLabel: RegExp | string) =>
  fireEvent.click(within(getRow(name)).getByRole("button", { name: buttonLabel }));



describe("AdminPage", () => {

  
  describe("Initial render", () => {
    it("renders the page heading", () => {
      render(<AdminPage />);
      expect(screen.getByRole("heading", { name: /Admin - Manage Buildings/i })).toBeInTheDocument();
    });


    it("renders the lifecycle filter", () => {
      render(<AdminPage />);
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("renders the search bar", () => {
      render(<AdminPage />);
      expect(screen.getByPlaceholderText(/building name/i)).toBeInTheDocument();
    });

    it("renders the Reset filters button", () => {
      render(<AdminPage />);
      expect(screen.getByRole("button", { name: /reset filters/i })).toBeInTheDocument();
    });
  });

  
  
  
  describe("Reset filters button", () => {
   
    it("resets lifecycle filter to 'all' when Reset filters is clicked", () => {
      render(<AdminPage />);
      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "active" } });
      expect((select as HTMLSelectElement).value).toBe("active");

      fireEvent.click(screen.getByRole("button", { name: /reset filters/i }));

      expect((select as HTMLSelectElement).value).toBe("all");
    });

    it("shows all buildings again after reset", () => {
      render(<AdminPage />);
      fireEvent.change(screen.getByPlaceholderText(/building name/i), {
        target: { value: "sandton" },
      });
      expect(screen.queryByText("greenhq")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /reset filters/i }));

      expect(screen.getByText("greenhq")).toBeInTheDocument();
    });
  });

  
  describe("Activate button", () => {
    it("shows Activate button for an inactive building", () => {
      render(<AdminPage />);
      expect(within(getRow("river")).getByRole("button", { name: /activate/i })).toBeInTheDocument();
    });

    it("shows Activate button for a provisioning building", () => {
      render(<AdminPage />);
      expect(within(getRow("tonhq")).getByRole("button", { name: /activate/i })).toBeInTheDocument();
    });

    it("does not show Activate button for an already active building", () => {
      render(<AdminPage />);
      expect(within(getRow("sandtonhq")).queryByRole("button", { name: /^activate$/i })).not.toBeInTheDocument();
    });

    it("changes building state to Active when Activate is clicked", () => {
      render(<AdminPage />);
      clickInRow("river", /activate/i);
      expect(within(getRow("river")).getByText("Active")).toBeInTheDocument();
    });
});


  
  describe("Deactivate button", () => {
    it("shows Deactivate button for an active building", () => {
      render(<AdminPage />);
      expect(within(getRow("sandtonhq")).getByRole("button", { name: /deactivate/i })).toBeInTheDocument();
    });

    
    it("changes building state to Inactive when Deactivate is clicked", () => {
      render(<AdminPage />);
      clickInRow("sandtonhq", /deactivate/i);
      expect(within(getRow("sandtonhq")).getByText("Inactive")).toBeInTheDocument();
    });


    it("shows Activate button after building is deactivated", () => {
      render(<AdminPage />);
      clickInRow("sandtonhq", /deactivate/i);
      expect(within(getRow("sandtonhq")).getByRole("button", { name: /activate/i })).toBeInTheDocument();
    });
  });

  
  describe("Edit button", () => {
    

    it("opens the edit cars when Edit is clicked", () => {
      render(<AdminPage />);
      clickInRow("sandtonhq", /^edit$/i);
      expect(screen.getByRole("heading", { name: /edit building/i })).toBeInTheDocument();
    });


    it("Update button in edit", () => {
      render(<AdminPage />);
      clickInRow("sandtonhq", /^edit$/i);
      expect(screen.getByRole("button", { name: /update/i })).toBeInTheDocument();
    });

    it(" Cancel button in edit", () => {
      render(<AdminPage />);
      clickInRow("sandtonhq", /^edit$/i);
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });
  });

  
  describe("Update button", () => {
    it("updates building name after saving", () => {
      render(<AdminPage />);
      clickInRow("sandtonhq", /^edit$/i);

      const nameInput = screen.getByPlaceholderText("sandtonhq");
      fireEvent.change(nameInput, { target: { value: "NewHQ" } });
      fireEvent.click(screen.getByRole("button", { name: /update/i }));

      expect(screen.getByText("NewHQ")).toBeInTheDocument();
    });


    it("shows error when building name is empty", () => {
      render(<AdminPage />);
      clickInRow("sandtonhq", /^edit$/i);
      fireEvent.change(screen.getByPlaceholderText("sandtonhq"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: /update/i }));
      expect(screen.getByText(/building name is required/i)).toBeInTheDocument();
    });

});

   describe("Delete button", () => {
    it("renders a Delete button for every building", () => {
      render(<AdminPage />);
      expect(screen.getAllByRole("button", { name: /delete/i })).toHaveLength(5);
    });

    it("removes the building from the table when Delete is confirmed", () => {
      render(<AdminPage />);
      clickInRow("river", /delete/i);
      expect(screen.queryByText("river")).not.toBeInTheDocument();
    });
  });

  
  describe("Search bar", () => {
    it("search buildings by name", () => {
      render(<AdminPage />);
      fireEvent.change(screen.getByPlaceholderText(/building name/i), {
        target: { value: "sandton" },
      });
      expect(screen.getByText("sandtonhq")).toBeInTheDocument();
      expect(screen.queryByText("greenhq")).not.toBeInTheDocument();
    });

    it("shows 'No buildings found' when search matches nothing", () => {
      render(<AdminPage />);
      fireEvent.change(screen.getByPlaceholderText(/building name/i), {
        target: { value: "zzznomatch" },
      });
      expect(screen.getByText(/No buildings found/i)).toBeInTheDocument();
    });
  });

  
  describe("Lifecycle filter", () => {
    it("filters to show only active buildings", () => {
      render(<AdminPage />);
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "active" } });
      expect(screen.getByText("sandtonhq")).toBeInTheDocument();
      expect(screen.queryByText("river")).not.toBeInTheDocument();
    });

    it("filters to show only failed buildings", () => {
      render(<AdminPage />);
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "failed" } });
      expect(screen.getByText("river")).toBeInTheDocument();
      expect(screen.queryByText("sandtonhq")).not.toBeInTheDocument();
    });

    it("shows all buildings when 'all' is selected", () => {
      render(<AdminPage />);
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "active" } });
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "all" } });
      expect(screen.getAllByRole("row").length).toBeGreaterThan(5);
    });
  });
});