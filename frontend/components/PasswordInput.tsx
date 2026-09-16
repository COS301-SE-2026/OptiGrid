"use client";
import { useState, type ChangeEvent,  type FocusEvent, type CSSProperties } from "react";

interface PasswordInputProperties {
    readonly id: string;
    readonly name: string;
    readonly value: string;
    readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    readonly onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
    readonly disabled?: boolean;
    readonly autoComplete?: string;
    readonly placeholder?: string;
    readonly ariaInvalid?: boolean;
    readonly ariaDescribedBy?: string;
    readonly className?: string;
    readonly style?: CSSProperties;
}

export default function PasswordInput({
    id,
    name,
    value,
    onChange,
    onBlur,
    disabled,
    autoComplete,
    placeholder,
    ariaInvalid,
    ariaDescribedBy,
    className,
    style
}: PasswordInputProperties) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="auth-password-field">
            <input
                id={id}
                name={name}
                type={visible ? "text" : "password"}
                autoComplete={autoComplete}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                disabled={disabled}
                className={`${className ?? "input"} auth-password-input`}
                style={style}
                placeholder={placeholder}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedBy}
                suppressHydrationWarning
            />
            <button
                className="auth-password-toggle"
                type="button"
                onClick={() => setVisible((prev) => !prev)}
                disabled={disabled}
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
            >
                {visible ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                        <path d="M3 3l18 18" />
                        <path d="M10.58 10.58a3 3 0 0 0 4.24 4.24" />
                        <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c7 0 10.5 7 10.5 7a13.16 13.16 0 0 1-3.05 4.17M6.61 6.61C3.9 8.36 1.5 12 1.5 12a13.2 13.2 0 0 0 5.06 5.61" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                        <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                )}
            </button>
        </div>
    );
}