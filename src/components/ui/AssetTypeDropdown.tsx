"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import styles from "./AssetTypeDropdown.module.css";

type AssetTypeOption = { value: string; label: string };

type AssetTypeDropdownProps = {
  value: string;
  options: AssetTypeOption[];
  onValueChange: (nextValue: string) => void;
  label?: string;
  disabled?: boolean;
};

/** Asset filter only: a keyboard-operable, select-only combobox with aligned popup. */
export default function AssetTypeDropdown({
  value,
  options,
  onValueChange,
  label = "Asset type",
  disabled = false,
}: AssetTypeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [above, setAbove] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId().replace(/:/g, "");
  const listId = `${generatedId}-listbox`;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("pointerdown", onOutside);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  function showMenu(nextIndex = selectedIndex) {
    if (disabled || options.length === 0) return;
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (bounds) {
      const roomBelow = window.innerHeight - bounds.bottom;
      const neededRoom = Math.min(260, window.innerHeight * 0.42);
      setAbove(roomBelow < neededRoom && bounds.top > roomBelow);
    }
    setHighlighted(nextIndex);
    setOpen(true);
  }

  function selectOption(index: number) {
    const option = options[index];
    if (!option) return;
    onValueChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled || !options.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = ((open ? highlighted : selectedIndex) + direction + options.length) % options.length;
      if (open) setHighlighted(next);
      else showMenu(next);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : options.length - 1;
      if (open) setHighlighted(next);
      else showMenu(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) selectOption(highlighted);
      else showMenu();
    } else if (event.key === "Escape") {
      if (open) event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const next = options.findIndex((option) => option.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (next !== -1) {
        event.preventDefault();
        if (open) setHighlighted(next);
        else showMenu(next);
      }
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${generatedId}-option-${highlighted}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : showMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={styles.selectedText}>{selected?.label ?? "All asset types"}</span>
        <ChevronDown className={styles.chevron} size={17} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={listId}
          className={`${styles.menu} ${above ? styles.above : ""}`}
          role="listbox"
          aria-label={label}
        >
          {options.map((option, index) => (
            <div
              role="option"
              aria-selected={option.value === value}
              id={`${generatedId}-option-${index}`}
              key={option.value}
              className={`${styles.option} ${index === highlighted ? styles.highlighted : ""} ${option.value === value ? styles.chosen : ""}`}
              onMouseEnter={() => setHighlighted(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={15} aria-hidden="true" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
