import { Categories } from "./data";

describe("FAQs data integrity", () => {
    it("has at least one category", () => {
        expect(Categories.length).toBeGreaterThan(0);
    });

    it("every category has a name which is not empty", () => {
        for (const category of Categories) {
            expect(category.category.trim()).not.toBe("");
        }
    });

    it("every category has at least one item", () => {
        for (const category of Categories) {
            expect(category.items.length).toBeGreaterThan(0);
        }
    });

    it("every item has a question which is not empty", () => {
        for (const category of Categories) {
            for (const item of category.items) {
                expect(item.question.trim()).not.toBe("");
            }
        }
    });

    it("every item has a non-empty answer", () => {
        for (const category of Categories) {
            for (const item of category.items) {
                expect(item.answer.trim()).not.toBe("");
            }
        }
    });

    it("category names are unique", () => {
        const names = Categories.map((c) => c.category);
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
    });

    it("questions within each category are unique", () => {
        for (const category of Categories) {
            const questions = category.items.map((i) => i.question);
            const unique = new Set(questions);
            expect(unique.size).toBe(questions.length);
        }
    });

    it("covers all implemented use cases", () => {
        const names = Categories.map((c) => c.category);
        expect(names).toContain("Sign Up & Account");
        expect(names).toContain("Login & Session");
        expect(names).toContain("Appearance");
        expect(names).toContain("Buildings");
        expect(names).toContain("Demand Forecast");
    });
});