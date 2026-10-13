import { useRef } from "react";

// Client half of the contact-form bot check (the server half is
// api/_lib/inquiry.js). `HoneypotField` renders an input real visitors never
// see; bots that fill every field give themselves away. `fields()` adds that
// value plus how long the form has been on screen — an instant submit is a
// bot too. Spread the result into the request body.
export function useSpamGuard() {
  const startedAt = useRef(Date.now());
  const honeypot = useRef("");
  return {
    onHoneypotChange: (e) => {
      honeypot.current = e.target.value;
    },
    fields: () => ({ contact_extra: honeypot.current, elapsedMs: Date.now() - startedAt.current }),
  };
}

export function HoneypotField({ guard }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
      <label>
        Leave this field empty
        <input type="text" name="contact_extra" tabIndex={-1} autoComplete="off" onChange={guard.onHoneypotChange} />
      </label>
    </div>
  );
}
