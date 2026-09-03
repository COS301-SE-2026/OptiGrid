import { cookies } from "next/headers";
import { parseSession, SESSION_COOKIE_NAME } from "../../lib/session";
import { PublicNav } from "../../components/PublicNav";
import { ContactForm } from "./contact-form";

export const metadata = { title: "Contact Us - OptiGrid" };

export default async function ContactPage() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    const user = parseSession(sessionCookie?.value);

    return (
        <div className="landing-page">
            <PublicNav signedIn={Boolean(user)} />
            <main role="main" aria-label="Contact us main content" className="contact-main">
                <ContactForm />
            </main>
            <footer className="landing-footer">
                <div className="landing-shell">
                    <span>© 2026 OptiGrid. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
}