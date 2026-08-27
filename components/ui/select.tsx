"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconCheck, IconChevronDown } from "@/components/ui/icons";

export type Option = { value: string; label: string };

/** The subset of a change event our call sites actually read. Keeping this
 * shape means every existing `onChange={(e) => …e.target.value}` keeps
 * working unchanged after the swap from a native <select>. */
type SelectChange = { target: { value: string; name?: string } };

export type SelectProps = {
  options: Option[];
  /** Rendered as the first, selectable row (""), e.g. "All statuses" / "Any". */
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (event: SelectChange) => void;
  name?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
};

export function Select({
  options,
  placeholder,
  value,
  defaultValue,
  onChange,
  name,
  id,
  className = "",
  disabled = false,
  required = false,
  "aria-label": ariaLabel,
}: SelectProps) {
  const rid = useId();
  const listId = `${id ?? rid}-listbox`;

  const rows = useMemo<Option[]>(
    () => (placeholder ? [{ value: "", label: placeholder }, ...options] : options),
    [options, placeholder],
  );

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? (placeholder ? "" : (options[0]?.value ?? "")));
  const current = isControlled ? value : internal;

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = rows.find((r) => r.value === current);
  const selectedIdx = Math.max(0, rows.findIndex((r) => r.value === current));

  function commit(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.({ target: { value: next, name } });
  }

  function openMenu() {
    if (disabled) return;
    setActiveIdx(selectedIdx);
    setOpen(true);
  }

  function closeMenu(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function choose(idx: number) {
    const row = rows[idx];
    if (!row) return;
    commit(row.value);
    closeMenu();
  }

  // Move focus onto the list when it opens so the arrow keys work immediately
  // (autoFocus is not honoured on a non-form element like <ul>).
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // Keep the active row scrolled into view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);

  // Close on Escape from anywhere while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); closeMenu(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(rows.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(activeIdx);
    } else if (e.key === "Tab") {
      closeMenu(false);
    }
  }

  const isPlaceholderSelected = !current && !!placeholder;

  return (
    <div className={`relative ${className}`}>
      {/* Carries the value into plain form submissions (incl. the GET filter forms). */}
      {name ? <input type="hidden" name={name} value={current ?? ""} required={required} /> : null}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={
          "flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border-2 " +
          "border-(--color-ink) bg-(--color-paper) px-3.5 text-left text-[15px] text-(--color-ink) " +
          "transition-colors duration-100 hover:bg-(--color-cream) " +
          "focus-visible:outline-[3px] focus-visible:outline-(--color-ink) focus-visible:outline-offset-2 " +
          "disabled:cursor-not-allowed disabled:border-(--color-ink)/30 disabled:bg-(--color-cream) disabled:text-(--color-ink)/50"
        }
      >
        <span className={`truncate ${isPlaceholderSelected ? "text-(--color-ink)/45" : ""}`}>
          {selected?.label ?? placeholder ?? ""}
        </span>
        <IconChevronDown
          className={`size-3.5 shrink-0 text-(--color-ink)/60 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <>
          {/* click-outside catcher */}
          <div className="fixed inset-0 z-40" onClick={() => closeMenu(false)} />
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={`${listId}-${activeIdx}`}
            onKeyDown={onListKeyDown}
            className={
              "animate-pop-in absolute left-0 top-full z-50 mt-1.5 max-h-64 w-full min-w-max overflow-y-auto " +
              "rounded-[var(--radius-card)] border-2 border-(--color-ink) bg-(--color-paper) p-1.5 shadow-offset-lg"
            }
          >
            {rows.map((row, idx) => {
              const isSelected = row.value === current;
              const isActive = idx === activeIdx;
              return (
                <li key={row.value || `__placeholder-${idx}`} id={`${listId}-${idx}`} data-idx={idx} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => choose(idx)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={
                      "flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm " +
                      "transition-colors duration-75 " +
                      (isActive ? "bg-(--color-cream) " : "") +
                      (isSelected ? "font-bold text-(--color-ink) " : "text-(--color-ink)/80 ") +
                      (!row.value && placeholder ? "text-(--color-ink)/55 " : "")
                    }
                  >
                    <span className="truncate">{row.label}</span>
                    {isSelected ? <IconCheck className="size-3.5 shrink-0 text-(--color-orange-deep)" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
