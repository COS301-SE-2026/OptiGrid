//this is the banner used to report a failed form submission
export function FormAlert({ message }: Readonly<{ message: string }>) {
    return (
        <div
            role="alert"
            style={{
                color: "var(--brand-danger)",
                padding: "var(--space-3) var(--space-4)",
                border: "1px solid var(--brand-danger)",
                background: "color-mix(in srgb, var(--brand-danger) 12%, transparent)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--fs-small)"
            }}
        >
            {message}
        </div>
    );
}