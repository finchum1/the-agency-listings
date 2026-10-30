import { useEffect, useId, useRef, useState } from "react";
import { suggestAddresses } from "../../../hooks/useCalendarEvents";

// A text field that suggests addresses as you type (api/places.js). It stays a plain text field: anything can be typed ("Zoom", "My office"), and a
// suggestion just fills in the text. Arrow keys and Enter pick one, Escape closes the list.
export default function AddressInput({ value, onChange, className, disabled, maxLength = 300 }) {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const typed = useRef(false); // true when the text changed because someone typed, false when a suggestion filled it in
  const timer = useRef(null);
  const abort = useRef(null);

  useEffect(() => {
    if (!typed.current) return undefined;
    clearTimeout(timer.current);
    abort.current?.abort();
    const q = value.trim();
    if (q.length < 3) {
      setList([]);
      return undefined;
    }
    timer.current = setTimeout(async () => {
      const ctl = new AbortController();
      abort.current = ctl;
      try {
        const found = await suggestAddresses(q, ctl.signal);
        if (!ctl.signal.aborted) {
          setList(found);
          setActive(-1);
          setOpen(found.length > 0);
        }
      } catch {
        /* no suggestions this time: the field still works as plain text */
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [value]);
  useEffect(() => () => abort.current?.abort(), []);

  const pick = (label) => {
    typed.current = false;
    onChange(label);
    setOpen(false);
    setList([]);
  };

  return (
    <div className="relative">
      <input
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
        }}
        onFocus={() => list.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % list.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? list.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(list[active].label);
          } else if (e.key === "Escape") {
            e.stopPropagation(); // closes the list, not the whole form
            setOpen(false);
          }
        }}
        className={className}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] text-[#1c1a17] dark:text-[#faf9f7] py-1 shadow-xl"
        >
          {list.map((s, i) => (
            <li
              key={s.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep the field focused so the list isn't closed before the click lands
                pick(s.label);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-black/5 dark:bg-white/10" : ""}`}
            >
              {s.label}
            </li>
          ))}
          <li aria-hidden="true" className="px-3 pt-1 pb-0.5 text-[10px] text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
            Suggestions from OpenStreetMap contributors
          </li>
        </ul>
      )}
    </div>
  );
}
