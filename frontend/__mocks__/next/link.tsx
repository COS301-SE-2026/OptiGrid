import type { AnchorHTMLAttributes, ReactNode } from "react";

export default function MockLink({
    href,
    children,
    ...rest
}: Readonly<{
    href: string;
    children: ReactNode;
    [key: string]: unknown;
}>) {
    return (
        <a href={href} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>{children}</a>
    );
}