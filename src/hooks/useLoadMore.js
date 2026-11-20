import { useEffect, useState } from "react";

// A long list shown a screenful at a time, with a "more" button for the next screenful: `{ phone, desktop }` is how many items show at first (and how many
// each press adds) on a phone (under 640px) and from there up. Returns { shown, hasMore, showMore, phone }. Resets to the first screenful if the list or
// the breakpoint changes.
const PHONE = "(max-width: 639px)";

export default function useLoadMore(items, { phone: onPhone = 4, desktop = 9 } = {}) {
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE).matches);
  const step = isPhone ? onPhone : desktop;
  const [count, setCount] = useState(step);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setIsPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => setCount(step), [step, items.length]);
  return { shown: items.slice(0, count), hasMore: count < items.length, showMore: () => setCount((c) => c + step), phone: isPhone };
}
