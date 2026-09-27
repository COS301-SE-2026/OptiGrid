import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LivingEnvironment } from "./LivingEnvironment";

jest.mock("framer-motion", () => {
  return {
    motion: new Proxy({}, {
      get: (_, tag: string) => {
        const Component = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
          ({ children, ...rest }, ref) => {
           
            const {
              animate: _animate,
              initial: _initial,
              transition: _transition,
              whileHover: _whileHover,
              whileTap: _whileTap,
              ...domProps
            } = rest as Record<string, unknown>;

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

  describe("Initial render", () => {
    it("renders the Living Environment heading", () => {
      renderEnv();
      expect(screen.getByRole("heading", { name: /living environment/i })).toBeInTheDocument();
    });

    it("renders the Scenario Performance heading", () => {
      renderEnv();
      expect(screen.getByRole("heading", { name: /scenario performance/i })).toBeInTheDocument();
    });

    it("renders the 'what is affecting' panel heading", () => {
      renderEnv();
      expect(screen.getByRole("heading", { name: /affecting the tree/i })).toBeInTheDocument();
    });

    it("renders a health score", () => {
      renderEnv();
      expect(screen.getByText(/health score/i)).toBeInTheDocument();
    });
  });

  describe("Sliders", () => {
    it("renders Energy Efficiency slider", () => {
      renderEnv();
      expect(getSlider(/energy efficiency/i)).toBeInTheDocument();
    });

    it("renders Renewable Energy slider", () => {
      renderEnv();
      expect(getSlider(/renewable energy/i)).toBeInTheDocument();
    });

    it("renders HVAC Optimization slider", () => {
      renderEnv();
      expect(getSlider(/hvac optimization/i)).toBeInTheDocument();
    });

    it("renders Lighting Optimization slider", () => {
      renderEnv();
      expect(getSlider(/lighting optimization/i)).toBeInTheDocument();
    });
  });

  describe("Tree stat cards", () => {
    it("renders Leaves stat", () => {
      renderEnv();
      expect(screen.getByText("Leaves")).toBeInTheDocument();
    });

    it("renders Bloom stat", () => {
      renderEnv();
      expect(screen.getByText("Bloom")).toBeInTheDocument();
    });
  });

  describe("Weightage note", () => {
    it("renders the weightage description", () => {
      renderEnv();
      expect(screen.getByText(/efficiency 35%/i)).toBeInTheDocument();
      expect(screen.getByText(/renewables 30%/i)).toBeInTheDocument();
    });
  });
});