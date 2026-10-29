import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Keeps one address parameter (?deal=, ?person=, ?contact=) equal to the item a page has open, so the dashboard tabs (and the back button) remember it.
 * `value` is the open item's id or null. The page's own state stays the source of truth: this only writes the address, as a replace so history isn't
 * filled with one step per click, and a parameter that another part of the page has since pointed at something else is left alone.
 */
export default function useUrlParamSync(name, value) {
  const location = useLocation();
  const navigate = useNavigate();
  const previous = useRef(value);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const current = params.get(name);
    let changed = false;
    if (value) {
      if (current !== value) {
        params.set(name, value);
        changed = true;
      }
    } else if (current && current === previous.current) {
      params.delete(name);
      changed = true;
    }
    previous.current = value;
    if (changed) {
      const search = params.toString();
      navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
    }
    // Runs when the open item changes, not on every address change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}
