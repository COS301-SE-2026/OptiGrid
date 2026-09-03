import { Categories, PublicCategories } from "./data";

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

describe("Public FAQs data", () => {
    it("has at least one category", () => {
        expect(PublicCategories.length).toBeGreaterThan(0);
    });

    it("every category has a name and at least has one item", () => {
        for (const category of PublicCategories) {
            expect(category.category.trim()).not.toBe("");
            expect(category.items.length).toBeGreaterThan(0);
        }
    });

    it("has unique category names", () => {
        const names = PublicCategories.map((c) => c.category);
        expect(new Set(names).size).toBe(names.length);
    });

    it("keeps the signup questions visitors need", () => {
        const names = PublicCategories.map((c) => c.category);
        expect(names).toContain("About OptiGrid");
        expect(names).toContain("Sign Up & Account");
    });

    it("every item has a question and an answer", () => {
        for (const category of PublicCategories) {
            for (const item of category.items) {
                expect(item.question.trim()).not.toBe("");
                expect(item.answer.trim()).not.toBe("");
            }
        }
    });

    it("leaves out categories that only apply once you are signed in", () => {
        const names = PublicCategories.map((c) => c.category);
        expect(names).not.toContain("Appearance");
        expect(names).not.toContain("Login & Session");
    });

    it("leaves out any questions about using the dashboard itself", () => {
        const questions = PublicCategories.flatMap((c) => c.items.map((item) => item.question));
        expect(questions).not.toContain("How do I log out?");
        expect(questions).not.toContain("How do I add a building?");
    });
});