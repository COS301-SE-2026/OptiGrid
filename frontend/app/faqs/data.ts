import faqs from "./faqs.json";

export type FAQItem = { question: string, answer: string};
export type FAQCategory = { category: string, items: FAQItem[] };

export const Categories: FAQCategory[] = faqs.categories;

export const PublicCategories: FAQCategory[] = faqs.publicCategories;
