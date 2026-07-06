import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ViewBuildingPage from "./page";


jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));



const mockBuilding = {
  building_id: "111",
  building_name: "building A",
  physical_address: "johannesburg",
  square_footage: 5000,
  timezone: "Africa/Johannesburg",
  max_occupancy: 200,
  latitude: -26.111,
  longitude: 28.055,
  geohash: "kgesj5h",
};


const makeParams = (buildingId: string) =>
  Promise.resolve({ buildingId });

const mockFetchOk = (buildings = [mockBuilding]) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: buildings }),
  });
};

const mockFetchNotFound = () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }), 
  });
};



const mockFetchNetworkError = () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
};


describe("ViewBuildingPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  



    it("renders the subtitle", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByText(/view information/i)).toBeInTheDocument()
      );
    });

    it("renders the Back button", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() => {
        const link = screen.getByRole("link", { name: /back/i });
        expect(link).toHaveAttribute("href", "/dashboard");
      });
    });

    it("renders the General Information heading", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByRole("heading", { name: /general information/i })).toBeInTheDocument()
      );
    });

    it("renders the Building Specifications heading", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByRole("heading", { name: /building specifications/i })).toBeInTheDocument()
      );
    });

    it("renders the Location Details heading", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByRole("heading", { name: /location details/i })).toBeInTheDocument()
      );
    });
  });

  
  describe("Building details is displayed", () => {
    it("displays the building name", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByText("building A")).toBeInTheDocument()
      );
    });

    it("displays the physical address", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByText("johannesburg")).toBeInTheDocument()
      );
    });

    it("displays the timezone", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByText("Africa/Johannesburg")).toBeInTheDocument()
      );
    });

    it("displays the square footage", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByText(/5000.*m²/)).toBeInTheDocument()
      );
    });

    it("displays the max occupancy", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByText("200")).toBeInTheDocument()
      );
    });

    it("displays the latitude", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByText("-26.111")).toBeInTheDocument()
      );
    });

    it("displays the longitude", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByText("28.055")).toBeInTheDocument()
      );
    });

    it("displays the geohash", async () => {
      mockFetchOk();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByText("kgesj5h")).toBeInTheDocument()
      );
    });
  });

  





  
  describe("Error handling", () => {
    it("shows an error when the building is not found", async () => {
  mockFetchNotFound();
  render(<ViewBuildingPage params={makeParams("111")} />);

  await waitFor(() =>
    expect(
      screen.getByText(/unable to load building details\./i)
    ).toBeInTheDocument()
  );
});
    


    it("shows error message when it cant load details ", async () => {
      mockFetchNetworkError();
      render(<ViewBuildingPage params={makeParams("111")} />);

      await waitFor(() =>
        expect(screen.getByText(/Unable to load building details./i)).toBeInTheDocument()
      );
    });


  });
