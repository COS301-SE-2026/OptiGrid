import { humanise } from "./labels";

describe("humanise", () => {
    it("turns stored enum values into sentence case", () => {
        expect(humanise("MIXED_USE")).toBe("Mixed use");
        expect(humanise("PROVISIONING_FAILED")).toBe("Provisioning failed");
        expect(humanise("In_Progress")).toBe("In progress");
        expect(humanise("OFFICE")).toBe("Office");
        expect(humanise("ShoppingCentre")).toBe("Shopping centre");
    });

    it("falls back when there is nothing to show", () => {
        expect(humanise(null)).toBe("-");
        expect(humanise("", "Unspecified")).toBe("Unspecified");
        expect(humanise("___")).toBe("-");
    });

    it("arranges stray separators and spacing", () => {
        expect(humanise("  power__usage ")).toBe("Power usage");
        expect(humanise("data-centre")).toBe("Data centre");
    });
});