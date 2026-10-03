// Call / Text / Email launchers — plain tel:, sms: and mailto: links, so
// they open the device's own Phone, Messages and Mail apps. Nothing is
// sent from inside this app.
function digits(phone) {
  return (phone || "").replace(/[^\d+]/g, "");
}

export default function ContactButtons({ person, size = "md" }) {
  const phone = digits(person.phone);
  const email = (person.email || "").trim();
  const base =
    size === "sm"
      ? "px-2 py-1 text-[11px]"
      : "px-3.5 py-2 text-sm";
  const active =
    "border border-black/10 dark:border-white/15 text-[#1c1a17]/80 dark:text-[#faf9f7]/80 hover:bg-black/5 dark:hover:bg-white/10";
  const disabled = "border border-black/5 dark:border-white/10 text-[#1c1a17]/25 dark:text-[#faf9f7]/25 cursor-not-allowed";
  const cls = (enabled) => `inline-flex items-center rounded-full font-medium transition-colors ${base} ${enabled ? active : disabled}`;
  const stop = (e) => e.stopPropagation();

  return (
    <div className="flex items-center gap-1.5 flex-wrap" onClick={stop}>
      {phone ? (
        <a href={`tel:${phone}`} className={cls(true)}>Call</a>
      ) : (
        <span className={cls(false)}>Call</span>
      )}
      {phone ? (
        <a href={`sms:${phone}`} className={cls(true)}>Text</a>
      ) : (
        <span className={cls(false)}>Text</span>
      )}
      {email ? (
        <a href={`mailto:${email}`} className={cls(true)}>Email</a>
      ) : (
        <span className={cls(false)}>Email</span>
      )}
    </div>
  );
}
