import { useEffect, useRef, useState } from "react";
import { describeSearch } from "../../lib/visitorSearch";
import { useVisitor } from "../../lib/visitorStore";

// The visitor's side of the public Home Search: a "Save search" button, the account button, the sign-in by emailed code, and the saved homes and
// searches. Rendered inside IdxListings; takes the site's colors from the page (--as-*). The state lives in lib/visitorStore.js.

const btn = "inline-flex items-center gap-2 rounded-full border border-[var(--as-text)]/15 px-4 py-2 text-xs font-medium uppercase tracked text-[var(--as-text)]/80 transition-colors hover:bg-[var(--as-text)] hover:text-[var(--as-bg)] disabled:opacity-50";
const primary = "rounded-full bg-[var(--as-dark)] px-5 py-2.5 text-xs font-medium uppercase tracked text-[var(--as-on-dark)] transition-opacity hover:opacity-85 disabled:opacity-50";
const input = "w-full rounded-full border border-[var(--as-text)]/15 bg-transparent px-4 py-3 text-sm text-[var(--as-text)] outline-none placeholder:text-[var(--as-text)]/40 focus:border-[var(--as-accent)]";

function Dialog({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("input,button,select")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto bg-[var(--as-bg)] p-6 text-[var(--as-text)] shadow-2xl sm:rounded-2xl sm:p-8 ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold leading-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 p-2 text-xl leading-none text-[var(--as-text)]/50 hover:text-[var(--as-text)]">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- signing in: an email, then the code that was sent to it
function SignIn({ store, reason, onClose }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await store.requestCode(email.trim(), { name: name.trim(), website: trap });
      setStep("code");
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await store.verify(email.trim(), code, name.trim());
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog title={step === "email" ? "Sign in to save" : "Enter your code"} onClose={onClose}>
      {step === "email" ? (
        <form onSubmit={send} className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--as-text)]/70">{reason || "Save homes and searches, and get an email when new homes match."} No password: we email you a 6-digit code.</p>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" autoComplete="name" maxLength={80} className={input} />
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" className={input} />
          <input type="text" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
          {error && <p className="text-sm text-[var(--as-accent)]" role="alert">{error}</p>}
          <button type="submit" disabled={busy || !email} className={`${primary} w-full`}>{busy ? "Sending…" : "Email me a code"}</button>
          <p className="text-xs leading-relaxed text-[var(--as-text)]/50">Signing in lets the agent follow up about homes you save. You can delete your account at any time.</p>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--as-text)]/70">We sent a 6-digit code to <strong>{email}</strong>. It works for 10 minutes.</p>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className={`${input} text-center text-2xl tracking-[0.4em]`} />
          {error && <p className="text-sm text-[var(--as-accent)]" role="alert">{error}</p>}
          <button type="submit" disabled={busy || code.length !== 6} className={`${primary} w-full`}>{busy ? "Checking…" : "Sign in"}</button>
          <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); }} className="w-full text-center text-xs text-[var(--as-text)]/60 underline underline-offset-2">Use a different email or send a new code</button>
        </form>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- saving the current search
function SaveSearch({ store, params, path, onClose }) {
  const [name, setName] = useState(describeSearch(params));
  const [alerts, setAlerts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await store.saveSearch({ name: name.trim(), params, alerts, path });
      store.notify(alerts ? "Search saved. We'll email you when new homes match." : "Search saved.");
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Dialog title="Save this search" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-medium uppercase tracked text-[var(--as-text)]/60">Name
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={`${input} mt-2 normal-case`} />
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--as-text)]/80">
          <input type="checkbox" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} className="mt-1 accent-[var(--as-accent)]" />
          <span>Email me when new homes match. One short email a day, and only when there is something new.</span>
        </label>
        {error && <p className="text-sm text-[var(--as-accent)]" role="alert">{error}</p>}
        <button type="submit" disabled={busy || !name.trim()} className={`${primary} w-full`}>{busy ? "Saving…" : "Save search"}</button>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------- the visitor's saved searches, saved homes and account
const money = (n) => (n === null || n === undefined ? "" : `$${Number(n).toLocaleString("en-US")}`);

function Panel({ store, account, onRun, onClose }) {
  const [tab, setTab] = useState("searches");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tabClass = (t) => `px-4 py-2 text-xs font-medium uppercase tracked rounded-full transition-colors ${tab === t ? "bg-[var(--as-dark)] text-[var(--as-on-dark)]" : "text-[var(--as-text)]/60 hover:text-[var(--as-text)]"}`;
  return (
    <Dialog title={account.visitor.name ? `Hi, ${account.visitor.name.split(" ")[0]}` : "Your saved items"} onClose={onClose} wide>
      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        <button role="tab" aria-selected={tab === "searches"} className={tabClass("searches")} onClick={() => setTab("searches")}>Searches ({account.searches.length})</button>
        <button role="tab" aria-selected={tab === "homes"} className={tabClass("homes")} onClick={() => setTab("homes")}>Homes ({account.favorites.length})</button>
        <button role="tab" aria-selected={tab === "account"} className={tabClass("account")} onClick={() => setTab("account")}>Account</button>
      </div>

      {tab === "searches" &&
        (account.searches.length === 0 ? (
          <p className="text-sm text-[var(--as-text)]/60">No saved searches yet. Set your filters, then choose Save search.</p>
        ) : (
          <ul className="space-y-3">
            {account.searches.map((s) => (
              <li key={s.id} className="rounded-xl border border-[var(--as-text)]/10 p-4">
                <p className="font-medium">{s.name}</p>
                <p className="mt-0.5 text-xs text-[var(--as-text)]/55">{describeSearch(s.params)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  <button type="button" onClick={() => onRun(s)} className="font-medium uppercase tracked text-[var(--as-accent)]">Run search</button>
                  <label className="flex cursor-pointer items-center gap-2 text-[var(--as-text)]/70">
                    <input type="checkbox" checked={s.alerts && !account.visitor.emailsOff} disabled={account.visitor.emailsOff} onChange={(e) => store.updateSearch(s.id, { alerts: e.target.checked })} className="accent-[var(--as-accent)]" />
                    Daily email
                  </label>
                  <button type="button" onClick={() => store.deleteSearch(s.id)} className="text-[var(--as-text)]/50 underline underline-offset-2 hover:text-[var(--as-text)]">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {tab === "homes" &&
        (account.favorites.length === 0 ? (
          <p className="text-sm text-[var(--as-text)]/60">No saved homes yet. Tap the heart on a home to keep it here.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {account.favorites.map((f) => (
              <li key={f.mls} className="flex gap-3 rounded-xl border border-[var(--as-text)]/10 p-3">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--as-surface)]">{f.snapshot.photo && <img src={f.snapshot.photo} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 text-sm">
                  <p className="font-display font-semibold">{money(f.snapshot.price) || "Saved home"}</p>
                  <p className="truncate text-[var(--as-text)]/70">{f.snapshot.address || `MLS# ${f.mls}`}</p>
                  <p className="truncate text-xs text-[var(--as-text)]/50">{[f.snapshot.city, f.snapshot.state].filter(Boolean).join(", ")}</p>
                  <button type="button" onClick={() => store.toggleFavorite({ mlsNumber: f.mls })} className="mt-1 text-xs text-[var(--as-text)]/50 underline underline-offset-2 hover:text-[var(--as-text)]">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {tab === "account" && (
        <div className="space-y-4 text-sm">
          <p><span className="text-[var(--as-text)]/55">Signed in as</span><br /><strong>{account.visitor.email}</strong></p>
          {account.visitor.emailsOff && <p className="text-xs text-[var(--as-text)]/60">You turned off saved-search emails. Your searches are still saved.</p>}
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" className={btn} onClick={() => store.signOut()}>Sign out</button>
            {!confirmDelete ? (
              <button type="button" className="text-xs text-[var(--as-text)]/50 underline underline-offset-2 hover:text-[var(--as-text)]" onClick={() => setConfirmDelete(true)}>Delete my account</button>
            ) : (
              <span className="flex items-center gap-3 text-xs">
                <span className="text-[var(--as-text)]/70">This removes your saved homes and searches.</span>
                <button type="button" className="font-medium text-[var(--as-accent)]" onClick={() => store.deleteAccount()}>Yes, delete</button>
              </span>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- the buttons beside the filters, and the dialogs they open
/**
 * `site`: {kind, id?}. `getParams()`: the filters as they are right now. `path`: this page, for the alert email's link. `onRun(savedSearch)`: apply a saved search.
 */
export default function VisitorBar({ site, getParams, path, onRun }) {
  const [state, store] = useVisitor(site);
  const [saving, setSaving] = useState(false);
  useEffect(() => { store.init(); }, [store]);
  const account = state.account;
  const startSave = () => {
    if (account) setSaving(true);
    else store.openSignIn("Sign in to save this search and get an email when new homes match.", () => setSaving(true));
  };
  return (
    <>
      <button type="button" onClick={startSave} className={btn}>Save search</button>
      {account ? (
        <button type="button" onClick={() => store.openPanel()} className={btn} aria-haspopup="dialog">
          Saved · {account.favorites.length + account.searches.length}
        </button>
      ) : (
        <button type="button" onClick={() => store.openSignIn("")} className={btn}>Sign in</button>
      )}
      {state.dialog && !state.dialog.panel && !account && <SignIn store={store} reason={state.dialog.reason} onClose={() => store.closeDialog()} />}
      {state.dialog?.panel && account && (
        <Panel store={store} account={account} onRun={(s) => { store.closeDialog(); onRun(s); }} onClose={() => store.closeDialog()} />
      )}
      {saving && account && <SaveSearch store={store} params={getParams()} path={path} onClose={() => setSaving(false)} />}
      {state.notice && <div role="status" className="fixed bottom-6 left-1/2 z-[110] -translate-x-1/2 rounded-full bg-[var(--as-dark)] px-5 py-3 text-sm text-[var(--as-on-dark)] shadow-xl">{state.notice}</div>}
    </>
  );
}
