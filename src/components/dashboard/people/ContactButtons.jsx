// Call / Text / Email launchers — plain tel:, sms: and mailto: links, so
// they open the device's own Phone, Messages and Mail apps. Nothing is
// sent from inside this app.
import { markResponded } from "./ResponseTimer";

function digits(phone) {
  return (phone || "").replace(/[^\d+]/g, "");
}

// `cc` copies someone on the email (a deal copies its agent), and `extraTo` adds more recipients (a deal's second client); `subject` fills the subject line.
export default function ContactButtons({ person, size = "md", cc = "", extraTo = [], subject = "" }) {
  const phone = digits(person.phone);
  const email = (person.email || "").trim();
  const to = [...new Set([email, ...extraTo.map((a) => String(a || "").trim())].filter(Boolean))];
  const copy = cc && !to.some((a) => a.toLowerCase() === cc.toLowerCase()) ? cc : "";
  const query = [copy && `cc=${encodeURIComponent(copy)}`, subject && `subject=${encodeURIComponent(subject)}`].filter(Boolean).join("&");
  const mailto = to.length ? `mailto:${to.join(",")}${query ? `?${query}` : ""}` : "";
  const base =
    size === "sm"
      ? "px-2 py-1 text-[11px]"
      : "px-3.5 py-2 text-sm";
  const active =
    "border border-black/10 dark:border-white/15 text-[#1c1a17]/80 dark:text-[#faf9f7]/80 hover:bg-black/5 dark:hover:bg-white/10";
  const disabled = "border border-black/5 dark:border-white/10 text-[#1c1a17]/25 dark:text-[#faf9f7]/25 cursor-not-allowed";
  const cls = (enabled) => `inline-flex items-center rounded-full font-medium transition-colors ${base} ${enabled ? active : disabled}`;
  const stop = (e) => e.stopPropagation();
  const reached = () => markResponded(person); // tapping Call, Text or Email on a new website lead is the first reach-out

  return (
    <div className="flex items-center gap-1.5 flex-wrap" onClick={stop}>
      {phone ? (
        <a href={`tel:${phone}`} onClick={reached} className={cls(true)}>Call</a>
      ) : (
        <span className={cls(false)}>Call</span>
      )}
      {phone ? (
        <a href={`sms:${phone}`} onClick={reached} className={cls(true)}>Text</a>
      ) : (
        <span className={cls(false)}>Text</span>
      )}
      {email ? (
        <a href={mailto} onClick={reached} title={copy ? `Copying ${copy}` : undefined} className={cls(true)}>Email</a>
      ) : (
        <span className={cls(false)}>Email</span>
      )}
    </div>
  );
}
