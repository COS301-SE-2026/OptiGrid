"use client"

import { useState } from "react";
import type { FAQCategory } from "./data";

export function FAQAccordion({ category }: { category: FAQCategory[] }) {
    const [openKey, setOpenKey] = useState<string | null>(null);
    return (
        <div className="faq-list">
            {category.map((category) => (
                <div key={category.category} className="faq-category">
                    <h2 className="faq-category-title">{category.category}</h2>
                    {category.items.map((item, i) => {
                        const key = `${category.category}-${i}`;
                        const open = openKey === key;
                        return (
                            <div key={key} className={`faq-item card ${open ? "faq-item-open" : ""}`}>
                                <button
                                    className="faq-question"
                                    onClick={() => setOpenKey(open ? null : key)}
                                    aria-expanded={open}
                                >
                                    <span>{item.question}</span>
                                    <span className="faq-chevron" aria-hidden="true">
                                        {open ? "−" : "+"}
                                    </span>
                                </button>
                                {open && (
                                    <p className="faq-answer">{item.answer}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}