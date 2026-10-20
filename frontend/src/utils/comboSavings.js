// What one unit of a combo cart line saves against buying its pieces separately.
export const getComboUnitSaving = (item) =>
  item?.kind === "COMBO" ? Math.max(Number(item.basePrice || 0) - Number(item.unitPrice || 0), 0) : 0;

export const getComboSavingsTotal = (items = []) =>
  items.reduce((sum, item) => sum + getComboUnitSaving(item) * Number(item.qty || 0), 0);
