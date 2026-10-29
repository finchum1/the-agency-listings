// The last data a page loaded, kept in memory for the length of the visit so that coming back to a page (switching dashboard tabs, say) shows what was
// there at once while the fresh copy loads behind it. Keys include the person's id, so nothing is ever shown to someone else.
const store = new Map();
export const cacheGet = (key) => (key ? store.get(key) : undefined);
export const cacheSet = (key, value) => {
  if (key) store.set(key, value);
};
