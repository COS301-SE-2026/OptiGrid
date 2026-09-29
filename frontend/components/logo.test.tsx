import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OptiGridLogo } from "./logo";

const getSvg = (container: HTMLElement) =>
  container.querySelector("svg") as SVGSVGElement;

describe("OptiGridLogo", () => {
  describe("default full logo", () => {
    it("renders an accessible image named OptiGrid", () => {
      render(<OptiGridLogo />);

      expect(screen.getByRole("img", { name: "OptiGrid" })).toBeInTheDocument();
    });

    it("uses the height and a proportional width", () => {
      const { container } = render(<OptiGridLogo />);
      const svg = getSvg(container);

      expect(svg).toHaveAttribute("height", "36");
      expect(svg).toHaveAttribute("viewBox", "0 0 326 96");
      expect(Number(svg.getAttribute("width"))).toBeCloseTo(36 * (326 / 96));
    });

    it("renders the OPTIGRID wordmark", () => {
      const { container } = render(<OptiGridLogo />);

      const text = container.querySelector("text") as SVGTextElement;
      const tspan = container.querySelector("tspan") as SVGTSpanElement;
      const gradId = container.querySelector("linearGradient")!.id;

      expect(text.textContent?.replace(/\s+/g, "")).toBe("OPTIGRID");
      expect(text).toHaveAttribute("fill", "currentColor");
      expect(tspan.textContent).toBe("GRID");
      expect(tspan).toHaveAttribute("fill", `url(#${gradId})`);
    });
  });

  describe("markOnly", () => {
    it("renders a square viewBox", () => {
      const { container } = render(<OptiGridLogo markOnly height={48} />);
      const svg = getSvg(container);

      expect(svg).toHaveAttribute("viewBox", "0 0 96 96");
      expect(svg).toHaveAttribute("width", "48");
      expect(svg).toHaveAttribute("height", "48");
      expect(container.querySelector("text")).toBeNull();
    });
  });

  describe("props", () => {
    it("applies a custom height and scales width accordingly", () => {
      const { container } = render(<OptiGridLogo height={72} />);
      const svg = getSvg(container);

      expect(svg).toHaveAttribute("height", "72");
      expect(Number(svg.getAttribute("width"))).toBeCloseTo(72 * (326 / 96));
    });

    it("applies the className", () => {
      const { container } = render(<OptiGridLogo className="nav-logo" />);

      expect(getSvg(container)).toHaveClass("nav-logo");
    });

    it("uses a custom title", () => {
      render(<OptiGridLogo title="OptiGrid home" />);

      expect(
        screen.getByRole("img", { name: "OptiGrid home" })
      ).toBeInTheDocument();
    });

    it("is hidden when the title is empty", () => {
      const { container } = render(<OptiGridLogo title="" />);
      const svg = getSvg(container);
      expect(svg).toHaveAttribute("role", "img");
  expect(svg).toHaveAttribute("aria-label", "OptiGrid");
  expect(svg).not.toHaveAttribute("aria-hidden");

      
      expect(screen.getByRole("img", { name: "OptiGrid" })).toBeInTheDocument();
    });
  });

  describe("graphic", () => {
    it("draws the hexagon and the bolt path", () => {
      const { container } = render(<OptiGridLogo />);

      expect(container.querySelectorAll("line")).toHaveLength(6);
      expect(container.querySelectorAll("circle")).toHaveLength(6);
      expect(container.querySelectorAll("path")).toHaveLength(1);
    });

    it("references one colonfree gradient id", () => {
      const { container } = render(<OptiGridLogo />);

      const gradient = container.querySelector("linearGradient")!;
      expect(gradient.id).toMatch(/^og-grad-[^:]+$/);
      expect(gradient.querySelectorAll("stop")).toHaveLength(3);

      const ref = `url(#${gradient.id})`;
      container
        .querySelectorAll("line")
        .forEach((l) => expect(l).toHaveAttribute("stroke", ref));
      container
        .querySelectorAll("circle, path")
        .forEach((s) => expect(s).toHaveAttribute("fill", ref));
    });

    it("gives each instance a gradient id", () => {
      const { container } = render(
        <>
          <OptiGridLogo />
          <OptiGridLogo />
        </>
      );

      const ids = Array.from(container.querySelectorAll("linearGradient")).map(
        (g) => g.id
      );

      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    });
  });
});