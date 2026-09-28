import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LivingEnvironment } from "./LivingEnvironment";
import { fetchEsgHealthScore } from "@/lib/esg";

jest.mock("@/lib/esg", () => ({
  fetchEsgHealthScore: jest.fn(),
}));

const mockFetchEsgHealthScore = fetchEsgHealthScore as jest.MockedFunction<typeof fetchEsgHealthScore>;

jest.mock("framer-motion", () => {
  return {
    motion: new Proxy({}, {
      get: (_, tag: string) => {
        const Component = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
          ({ children, ...rest }, ref) => {
            const domProps = { ...rest } as Record<string, unknown>;
            for (const motionProp of ["animate", "initial", "transition", "whileHover", "whileTap"]) {
              delete domProps[motionProp];
            }

            return React.createElement(tag, { ...domProps, ref }, children);
          }
        );
        Component.displayName = `MotionProxy(${tag})`;
        return Component;
      },
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

const renderEnv = (buildingId = "building-1") =>
  render(<LivingEnvironment buildingId={buildingId} />);

const getSlider = (label: RegExp) =>
  screen.getByRole("slider", { name: label }) as HTMLInputElement;


export const setSlider = (label: RegExp, value: number) =>
  fireEvent.change(getSlider(label), { target: { value: String(value) } });

describe("LivingEnvironment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchEsgHealthScore.mockResolvedValue({
      buildingId: "building-1",
      score: 54,
      scoreLabel: "Operational environmental proxy",
      computedAt: "2026-09-28T12:00:00.000Z",
      trend: 0,
      dimensions: [
        { dimension: "energy_efficiency", label: "Energy Efficiency", score: 80, weight: 0.35, trend: 0 },
        { dimension: "renewables", label: "Renewable Energy", score: 0, weight: 0.3, trend: 0 },
        { dimension: "hvacLoad", label: "HVAC Optimization", score: 60, weight: 0.2, trend: 0 },
        { dimension: "lighting", label: "Lighting Optimization", score: 70, weight: 0.15, trend: 0 },
      ],
      carbonIntensity: 0.93,
      carbonAccounting: {
        source: "carbon_ledger",
        periodDate: "2026-09-28",
        totalKwh: 100,
        totalKgCo2e: 93,
        emissionFactorKgCo2ePerKwh: 0.93,
        integrityStatus: "VALID",
      },
      scope: {
        primaryPillar: "environmental",
        energyEvidence: "telemetry_derived",
        carbonEvidence: "ledger_backed",
        governanceEvidence: "carbon_ledger_integrity_only",
        socialMetrics: "not_included",
      },
      energyHistory: [10, 12, 11],
    });
  });

  describe("Initial render", () => {
    it("shows skeletons instead of unavailable values while evidence is loading", () => {
      mockFetchEsgHealthScore.mockReturnValue(new Promise<never>(() => undefined));
      const { container } = renderEnv();

      expect(screen.getByRole("status")).toHaveTextContent(/loading environmental evidence/i);
      expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
      expect(screen.queryByText(/^unavailable$/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    });

    it("renders the Environmental Performance heading", () => {
      renderEnv();
      expect(screen.getByRole("heading", { name: /environmental performance/i })).toBeInTheDocument();
    });

    it("renders the Scenario Performance heading", () => {
      renderEnv();
      expect(screen.getByRole("heading", { name: /scenario performance/i })).toBeInTheDocument();
    });

    it("renders the environmental score drivers heading", () => {
      renderEnv();
      expect(screen.getByRole("heading", { name: /environmental score drivers/i })).toBeInTheDocument();
    });

    it("renders an environmental score", () => {
      renderEnv();
      expect(screen.getAllByText(/environmental score/i).length).toBeGreaterThan(0);
    });
  });

  describe("Sliders", () => {
    it("renders Energy Efficiency slider", async () => {
      renderEnv();
      expect(await screen.findByRole("slider", { name: /energy efficiency/i })).toBeInTheDocument();
    });

    it("renders Renewable Energy slider", async () => {
      renderEnv();
      expect(await screen.findByRole("slider", { name: /renewable energy/i })).toBeInTheDocument();
    });

    it("renders HVAC Optimization slider", async () => {
      renderEnv();
      expect(await screen.findByRole("slider", { name: /hvac optimization/i })).toBeInTheDocument();
    });

    it("renders Lighting Optimization slider", async () => {
      renderEnv();
      expect(await screen.findByRole("slider", { name: /lighting optimization/i })).toBeInTheDocument();
    });
  });

  describe("Tree stat cards", () => {
    it("renders carbon intensity from the ledger-backed response", async () => {
      renderEnv();
      expect(await screen.findByText("0.930 kg CO2e/kWh")).toBeInTheDocument();
    });

    it("renders carbon-ledger integrity and the limited ESG scope", async () => {
      renderEnv();
      expect(await screen.findByText("VALID")).toBeInTheDocument();
      expect(screen.getByText(/derived from recent energy telemetry/i)).toBeInTheDocument();
      expect(screen.getByText(/social metrics are not included/i)).toBeInTheDocument();
    });

    it("preserves a legitimate zero score returned by the API", async () => {
      renderEnv();
      await waitFor(() => expect(getSlider(/renewable energy/i)).toHaveValue("0"));
    });
  });

  describe("Weightage note", () => {
    it("renders the weightage description", async () => {
      renderEnv();
      expect(await screen.findByText(/efficiency 35%/i)).toBeInTheDocument();
      expect(screen.getByText(/renewables 30%/i)).toBeInTheDocument();
    });
  });
});
