import Link from "next/link";
import { OptiGridLogo } from "@/components/logo";
import { SessionNavActions } from "@/components/SessionNavActions";

export function PublicNav({
    signedIn,
    anchorPrefix = "/",
    wide = false,
    detectSession = false,
}: Readonly<{
    signedIn: boolean;
    anchorPrefix?: string;
    wide?: boolean;
    detectSession?: boolean;
}>) {
    const backToDashboard = <Link href="/dashboard" className="btn btn-primary">Back to dashboard</Link>;
    const signedOutActions = (
        <>
            <Link href="/login" className="btn btn-secondary">Log in</Link>
            <Link href="/signup" className="btn btn-primary">Get started free</Link>
        </>
    );

    let actions = signedOutActions;
    if (signedIn) {
        actions = backToDashboard;
    } else if (detectSession) {
        actions = <SessionNavActions signedInActions={backToDashboard}>{signedOutActions}</SessionNavActions>;
    }

    //the landing page sits outside the tab session and for a signed in visitor the logo leads to the dashboard instead
    return (
        <header className="navbar landing-nav">
            <div className={wide ? "landing-shell landing-shell-wide landing-nav-inner" : "landing-shell landing-nav-inner"}>
                <Link
                    href={signedIn ? "/dashboard" : "/"}
                    aria-label={signedIn ? "OptiGrid dashboard" : "OptiGrid home"}
                    className="landing-wordmark"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        color: "var(--brand-ink)",
                        textDecoration: "none",
                    }}
                >
                    <OptiGridLogo height={30} />
                </Link>
                {signedIn ? null : (
                    <nav className="landing-links" aria-label="Primary">
                        <a href={`${anchorPrefix}#features`}>Features</a>
                        <a href={`${anchorPrefix}#outcomes`}>Outcomes</a>
                        <Link href="/brandstyle">Brand</Link>
                    </nav>
                )}
                <div className="landing-nav-actions">{actions}</div>
            </div>
        </header>
    );
}