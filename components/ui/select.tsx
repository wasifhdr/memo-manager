"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconSearch } from "@/components/ui/icons";

export type Option = { value: string; label: string };

/** The subset of a change event our call sites actually read. Keeping this
 * shape means every existing `onChange={(e) => …e.target.value}` keeps
 * working unchanged after the swap from a native <select>. */
type SelectChange = { target: { value: string; name?: string } };

/** Past this many rows, scanning beats reading — the menu grows a search box. */
const SEARCH_THRESHOLD = 8;

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
  /** Force the search box on or off; by default it appears past SEARCH_THRESHOLD rows. */
  searchable?: boolean;
  "aria-label"?: string;
};

type MenuBox = {
  left: number;
  width: number;
  top: number;
  bottom: number;
  maxHeight: number;
  openUp: boolean;
};

const MENU_GAP = 6;
const MENU_MARGIN = 12;
const MENU_IDEAL = 288;

/** Where the menu should sit, in viewport coordinates, given the trigger. */
function measure(trigger: HTMLElement): MenuBox {
  const r = trigger.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - MENU_GAP - MENU_MARGIN;
  const above = r.top - MENU_GAP - MENU_MARGIN;
  // Drop down by default; flip up only when that genuinely buys more room.
  const openUp = below < Math.min(MENU_IDEAL, above) && above > below;
  return {
    left: r.left,
    width: r.width,
    top: r.bottom + MENU_GAP,
    bottom: window.innerHeight - r.top + MENU_GAP,
    maxHeight: Math.max(140, Math.min(MENU_IDEAL, openUp ? above : below)),
    openUp,
  };
}

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
  searchable,
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
  const [menu, setMenu] = useState<MenuBox | null>(null);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const withSearch = searchable ?? rows.length > SEARCH_THRESHOLD;

  // Everything index-based below walks the filtered rows, not the full list.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.label.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const selected = rows.find((r) => r.value === current);

  function commit(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.({ target: { value: next, name } });
  }

  function openMenu() {
    if (disabled) return;
    setQuery("");
    setActiveIdx(Math.max(0, rows.findIndex((r) => r.value === current)));
    // Measured here as well as in the effect below, so the first paint already
    // has the right coordinates instead of a frame at the last known ones.
    if (triggerRef.current) setMenu(measure(triggerRef.current));
    setOpen(true);
  }

  function closeMenu(refocus = true) {
    setOpen(false);
    setMenu(null);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  }

  function choose(idx: number) {
    const row = visible[idx];
    if (!row) return;
    commit(row.value);
    closeMenu();
  }

  // The menu is positioned against the viewport rather than the trigger, so an
  // ancestor that clips or scrolls — a modal, a card, a table cell — cannot cut
  // it off. That means re-measuring whenever anything moves underneath it.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (el) setMenu(measure(el));
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Move focus into the menu when it opens — onto the search box when there is
  // one, otherwise onto the list itself (autoFocus is not honoured on a <ul>).
  useEffect(() => {
    if (!open) return;
    if (withSearch) searchRef.current?.focus();
    else listRef.current?.focus();
  }, [open, withSearch]);

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

  /** Shared by the list and the search box, so typing and arrowing coexist. */
  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(visible.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(visible.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(activeIdx);
    } else if (e.key === " " && !withSearch) {
      // With a search box, space is a character, not a chooser.
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
          <div
            style={{
              position: "fixed",
              left: menu?.left ?? 0,
              width: menu?.width,
              minWidth: menu?.width,
              maxHeight: menu?.maxHeight,
              ...(menu?.openUp ? { bottom: menu.bottom } : { top: menu?.top ?? 0 }),
              visibility: menu ? "visible" : "hidden",
            }}
            className={
              "animate-pop-in z-50 flex flex-col " +
              "rounded-[var(--radius-card)] border-2 border-(--color-ink) bg-(--color-paper) p-1.5 shadow-offset-lg"
            }
          >
            {withSearch ? (
              <div className="relative mb-1.5 shrink-0">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-(--color-ink)/45" />
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                  onKeyDown={onMenuKeyDown}
                  placeholder="Search…"
                  aria-label="Search options"
                  aria-controls={listId}
                  aria-expanded
                  aria-activedescendant={visible.length ? `${listId}-${activeIdx}` : undefined}
                  className={
                    "h-9 w-full rounded-[var(--radius-control)] border border-(--color-sand) bg-(--color-cream) " +
                    "pl-8 pr-3 text-sm text-(--color-ink) outline-none placeholder:text-(--color-ink)/45 " +
                    "focus:border-(--color-ink)"
                  }
                />
              </div>
            ) : null}

            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-activedescendant={visible.length ? `${listId}-${activeIdx}` : undefined}
              onKeyDown={withSearch ? undefined : onMenuKeyDown}
              className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {visible.length === 0 ? (
                <li className="px-3 py-2 text-sm text-(--color-ink)/50">No matches.</li>
              ) : (
                visible.map((row, idx) => {
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
                })
              )}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
