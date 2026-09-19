import React from "react";
import { render, screen, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";
import { LivingEnvironment } from "./LivingEnvironment";



jest.mock("framer-motion", () => {
  const React = require("react");
  const Motion = ({ children, ...props }: any) => {
    const { animate, initial, transition, whileHover, ...rest } = props;
    return React.createElement("div", rest, children);
  };
  return {
    motion: new Proxy({}, {
      get: (_, tag: string) => {
        const React = require("react");
        return React.forwardRef(({ children, animate, initial, transition, whileHover, whileTap, ...rest }: any, ref: any) =>
          React.createElement(tag, { ...rest, ref }, children)
        );
      },
    }),
    AnimatePresence: ({ children }: any) => children,
  };
});


const renderEnv = (buildingId = "building-1") =>
  render(<LivingEnvironment buildingId={buildingId} />);

const getSlider = (label: RegExp) =>
  screen.getByRole("slider", { name: label }) as HTMLInputElement;

const setSlider = (label: RegExp, value: number) =>
  fireEvent.change(getSlider(label), { target: { value: String(value) } });


describe("LivingEnvironment", () => {

  describe("Initial render", () => {
    it("renders the Living Environment heading", () => {
      renderEnv();
      expect(screen.getByRole("heading", { name: /living environment/i })).toBeInTheDocument();
    });

    it("renders the Building Performance heading", () => {
      renderEnv();
      expect(screen.getByRole("heading", { name: /building performance/i })).toBeInTheDocument();
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

  describe("Sliders — initial values", () => {
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