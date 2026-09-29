import Link from "next/link";
import { OptiGridLogo } from "@/components/logo";

export function PublicNav({
    signedIn,
    anchorPrefix = "/",
    wide = false,
}: Readonly<{
    signedIn: boolean;
    anchorPrefix?: string;
    wide?: boolean;
}>) {
    return (
        <header className="navbar landing-nav">
            <div className={wide ? "landing-shell landing-shell-wide landing-nav-inner" : "landing-shell landing-nav-inner"}>
                <Link
                    href="/"
                    aria-label="OptiGrid home"
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
                <div className="landing-nav-actions">
                    {signedIn ? (
                        <Link href="/dashboard" className="btn btn-primary">Back to dashboard</Link>
                    ) : (
                        <>
                            <Link href="/login" className="btn btn-secondary">Log in</Link>
                            <Link href="/signup" className="btn btn-primary">Get started free</Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}