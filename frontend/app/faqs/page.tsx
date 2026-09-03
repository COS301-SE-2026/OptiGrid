import { cookies } from "next/headers";
import { parseSession, SESSION_COOKIE_NAME } from "../../lib/session";
import { Categories, PublicCategories } from "./data";
import { FAQAccordion } from "./accordion";
import { PublicNav } from "../../components/PublicNav";

export const metadata = { title: "FAQs - OptiGrid" };

export default async function FaqsPage() {
    const cookieStore = await cookies();
    const sessionName = cookieStore.get(SESSION_COOKIE_NAME);
    const user = parseSession(sessionName?.value);
    const categories = user ? Categories : PublicCategories;

    return (
        <div className="landing-page">
            <PublicNav signedIn={Boolean(user)} />
            <main>
                <section className="landing-section">
                    <div className="landing-shell">
                        <div className="landing-section-header">
                            <h1>Frequently Asked Questions</h1>
                            <p className="text-muted">
                                {user
                                    ? "Everything you need to know about OptiGrid"
                                    : "What OptiGrid does, what you get with an account, and how to get started"}
                            </p>
                        </div>
                        <FAQAccordion category={categories} />
                    </div>
                </section>
            </main>
            <footer className="landing-footer">
                <div className="landing-shell">
                    <span>© 2026 OptiGrid. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}