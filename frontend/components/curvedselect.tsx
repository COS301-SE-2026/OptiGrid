"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface CurvedSelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface CurvedSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: CurvedSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  ariaDescribedBy?: string;
  ariaLabel?: string;
  maxHeight?: number;
}

export function CurvedSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  hasError = false,
  ariaDescribedBy,
  ariaLabel,
  maxHeight = 260,
}: CurvedSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const listId = id ? `${id}-listbox` : undefined;

  
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  
  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < maxHeight && spaceAbove > spaceBelow;

      setPopupStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        maxHeight: Math.min(
          maxHeight,
          openUp ? spaceAbove - 12 : spaceBelow - 12
        ),
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, maxHeight]);

 
  useEffect(() => {
    if (!open || highlight < 0) return;
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const commit = (idx: number) => {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => Math.min(options.length - 1, h < 0 ? 0 : h + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        break;
      case "Home":
        e.preventDefault();
        setHighlight(0);
        break;
      case "End":
        e.preventDefault();
        setHighlight(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(highlight);
        break;
    }
  };

  return (
    <div ref={rootRef} className="curved-select">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-invalid={hasError || undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`curved-select-trigger${hasError ? " curved-select-trigger-error" : ""}`}
      >
        <span className="curved-select-value">
          {selected ? selected.label : placeholder}
        </span>
        <svg
          aria-hidden
          className={`curved-select-chevron${open ? " is-open" : ""}`}
          width="12"
          height="8"
          viewBox="0 0 12 8"
        >
          <path
            d="M1 1l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="curved-select-list"
          style={popupStyle}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlight;
            const cls = [
              "curved-select-option",
              isSelected && "is-selected",
              isHighlighted && "is-highlighted",
              opt.disabled && "is-disabled",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(idx);
                }}
                className={cls}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}