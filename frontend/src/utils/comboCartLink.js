// Link from a cart combo nudge to the combo page with the customer's cart
// items already picked. The combo page reads it back with parseFromCartParam.

export const buildComboFromCartPath = (slug, matched = []) => {
  const picks = matched.map(({ itemId, slotId, productId, size }) => ({ itemId, slotId, productId, size }));
  return `/combo-packs/${slug}?fromCart=${encodeURIComponent(JSON.stringify(picks))}`;
};

export const parseFromCartParam = (search = "") => {
  try {
    const raw = new URLSearchParams(search).get("fromCart");
    const picks = raw ? JSON.parse(raw) : [];
    return Array.isArray(picks) ? picks.filter((pick) => pick?.itemId && pick?.slotId && pick?.productId) : [];
  } catch {
    return [];
  }
};
