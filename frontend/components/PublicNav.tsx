import Link from "next/link";

export function PublicNav({
    signedIn,
    anchorPrefix = "/",
}: Readonly<{
    signedIn: boolean;
    anchorPrefix?: string;
}>) {
    return (
        <header className="navbar landing-nav">
            <div className="landing-shell landing-nav-inner">
                <Link href="/" className="landing-wordmark">OptiGrid</Link>
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