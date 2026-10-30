import { useEffect, useState } from "react";

// On a phone a long list shows `step` items at a time, with a "Show more" button under them that reveals the next `step`. From the `sm` breakpoint
// up (640px) everything shows and `hasMore` is always false. Returns { shown, hasMore, showMore }.
const PHONE = "(max-width: 639px)";

export default function useShowMore(items, step = 3) {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE).matches);
  const [count, setCount] = useState(step);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const onChange = () => setPhone(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const shown = phone ? items.slice(0, count) : items;
  return { shown, hasMore: phone && count < items.length, showMore: () => setCount((c) => c + step) };
}
