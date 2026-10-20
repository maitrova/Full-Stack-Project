import ComboPack from "../models/ComboPack.js";
import { getInStockSizeOptions, getProductImage } from "./cartOfferService.js";

const refId = (value) => {
  const id = value?._id || value;
  return id ? String(id) : "";
};

const roundRupees = (value) => Math.round(Number(value || 0));

// Flattens a cart item (populated or not) into what the combo matcher needs.
// Only loose readymade products can become part of a combo.
export const toComboLine = (item) => {
  const product = item?.readymadeProduct || null;
  return {
    itemId: refId(item),
    kind: item?.kind || "",
    productId: item?.kind === "READYMADE" ? refId(product) : "",
    title: product?.title || "",
    size: item?.size || null,
    qty: Number(item?.qty || 0),
    unitPrice: Number(item?.unitPrice || 0),
  };
};

/**
 * A combo's slots in display order: one per selection group, or one per
 * fixed product for older combos that list `items` instead of groups.
 * Fixed items keep their stored order (saved sorted) so `item-<index>` lines
 * up with the cart's combo validation.
 */
export const getComboSlots = (combo) => {
  const groups = Array.isArray(combo?.selectionGroups) ? combo.selectionGroups : [];
  if (groups.length) {
    return [...groups]
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .map((group, index) => ({
        slotId: refId(group) || `group-${index}`,
        label: group.label || group.category?.name || "",
        products: (group.eligibleProducts || []).filter((product) => product && typeof product === "object"),
      }));
  }

  return (combo?.items || []).map((item, index) => ({
    slotId: `item-${index}`,
    label: item.product?.title || "",
    products: item.product && typeof item.product === "object" ? [item.product] : [],
  }));
};

// Fills as many slots as possible from the cart, each cart line used once.
// Slots with the fewest matching lines go first so a line that fits several
// slots does not take the only option for another one.
const matchCartLinesToSlots = (slots, lines) => {
  const options = slots.map((slot) => {
    const productIds = new Set(slot.products.filter((p) => p.isActive !== false).map(refId));
    return lines.filter((line) => line.productId && productIds.has(line.productId));
  });

  const order = slots.map((_, index) => index).sort((a, b) => options[a].length - options[b].length);
  const usedItemIds = new Set();
  const matches = new Array(slots.length).fill(null);

  for (const index of order) {
    const line = options[index].find((entry) => !usedItemIds.has(entry.itemId));
    if (!line) continue;
    usedItemIds.add(line.itemId);
    matches[index] = line;
  }
  return matches;
};

// In-stock products for a missing slot, each size priced with what the
// customer would save by completing the combo with it.
const getSlotCandidates = ({ slot, matchedTotal, comboPrice, excludeProductIds }) => {
  const candidates = [];
  for (const product of slot.products) {
    if (product.isActive === false || excludeProductIds.has(refId(product))) continue;

    const sizes = getInStockSizeOptions(product)
      .map((entry) => ({
        size: entry.size,
        price: entry.price,
        mrp: entry.mrp,
        savings: roundRupees(matchedTotal + entry.price - comboPrice),
      }))
      .filter((entry) => entry.savings > 0);
    if (!sizes.length) continue;

    const lowest = sizes.reduce((best, entry) => (entry.price < best.price ? entry : best));
    candidates.push({
      _id: refId(product),
      title: product.title,
      image: getProductImage(product),
      currency: product.currency || "INR",
      price: lowest.price,
      mrp: lowest.mrp,
      // The cheapest size gives the smallest saving, so this is "at least".
      savings: lowest.savings,
      sizes: sizes.map(({ size, price, savings }) => ({ size, price, savings })),
    });
  }
  return candidates.sort((a, b) => b.savings - a.savings || a.price - b.price);
};

const getHighestInStockPrice = (slot, excludeProductIds) => {
  const prices = slot.products
    .filter((product) => product.isActive !== false && !excludeProductIds.has(refId(product)))
    .flatMap((product) => getInStockSizeOptions(product).map((entry) => entry.price));
  return prices.length ? Math.max(...prices) : null;
};

const evaluateCombo = (combo, lines, candidateLimit) => {
  const slots = getComboSlots(combo);
  if (slots.length < 2) return null;

  const matches = matchCartLinesToSlots(slots, lines);
  if (!matches.some(Boolean)) return null;

  const comboPrice = Number(combo.comboPrice || 0);
  const matched = slots
    .map((slot, index) => (matches[index] ? { slot, line: matches[index] } : null))
    .filter(Boolean)
    .map(({ slot, line }) => ({
      itemId: line.itemId,
      slotId: slot.slotId,
      productId: line.productId,
      title: line.title,
      size: line.size,
      unitPrice: line.unitPrice,
    }));
  const missingSlots = slots
    .filter((_, index) => !matches[index])
    .map((slot) => ({ slotId: slot.slotId, label: slot.label }));
  const matchedTotal = matched.reduce((sum, entry) => sum + entry.unitPrice, 0);
  const excludeProductIds = new Set(combo.allowDuplicateProducts ? [] : matched.map((entry) => entry.productId));

  const base = {
    comboId: refId(combo),
    comboName: combo.name,
    comboSlug: combo.slug,
    comboPrice,
    currency: combo.currency || "INR",
    image: combo.featuredImage || combo.bannerImage || null,
    matched,
    missingSlots,
  };

  if (!missingSlots.length) {
    const savings = roundRupees(matchedTotal - comboPrice);
    return savings > 0 ? { ...base, type: "SWITCH", savings, candidates: [] } : null;
  }

  if (missingSlots.length === 1) {
    const slot = slots.find((entry) => entry.slotId === missingSlots[0].slotId);
    const candidates = getSlotCandidates({ slot, matchedTotal, comboPrice, excludeProductIds }).slice(0, candidateLimit);
    if (!candidates.length) return null;
    return { ...base, type: "ADD_ONE", savings: candidates[0].savings, candidates };
  }

  // Two or more pieces missing: the cart links to the combo page instead, with
  // the best saving the customer could reach there.
  let reachableTotal = matchedTotal;
  for (const missing of missingSlots) {
    const slot = slots.find((entry) => entry.slotId === missing.slotId);
    const price = getHighestInStockPrice(slot, excludeProductIds);
    if (price === null) return null;
    reachableTotal += price;
  }
  const savings = roundRupees(reachableTotal - comboPrice);
  return savings > 0 ? { ...base, type: "COMPLETE", savings, candidates: [] } : null;
};

/**
 * Combo nudges for the cart: which combos the loose items already belong to,
 * what is missing, and how much the customer saves by completing each one.
 * Best savings first, at most `limit` combos.
 */
export const buildComboSuggestions = ({ lines = [], combos = [], limit = 2, candidateLimit = 8 }) =>
  combos
    .filter((combo) => combo && combo.status === "ACTIVE")
    .map((combo) => evaluateCombo(combo, lines, candidateLimit))
    .filter(Boolean)
    .sort((a, b) => b.savings - a.savings)
    .slice(0, limit);

/**
 * Turns a "convert to combo" request into combo selections in slot order.
 * Each requested slot is filled either from a loose cart line (`itemId`, its
 * product and size are reused) or from a new product (`productId` + `size`).
 * Returns the selections plus the cart lines they use; throws on bad input.
 * Stock, size and eligibility of new products are checked by the cart's
 * combo validation afterwards.
 */
export const resolveConvertSelections = ({ combo, cartLines = [], selections = [] }) => {
  const slots = getComboSlots(combo);
  const requested = new Map();
  for (const selection of Array.isArray(selections) ? selections : []) {
    const slotId = String(selection?.slotId || "");
    if (!slots.some((slot) => slot.slotId === slotId)) {
      throw new Error("Combo selection does not match this combo");
    }
    if (requested.has(slotId)) throw new Error("Each combo piece can only be chosen once");
    requested.set(slotId, selection);
  }

  const usedItemIds = new Set();
  const rawSelections = slots.map((slot) => {
    const selection = requested.get(slot.slotId);
    if (!selection) throw new Error(`Choose a ${slot.label || "product"} to complete the combo`);

    if (!selection.itemId) {
      return {
        productId: String(selection.productId || ""),
        size: selection.size || "",
        color: selection.color || "",
      };
    }

    const itemId = String(selection.itemId);
    const line = cartLines.find((entry) => entry.itemId === itemId);
    if (!line || !line.productId) throw new Error("That item is no longer in your cart");
    if (usedItemIds.has(itemId)) throw new Error("A cart item can only fill one combo piece");

    const product = slot.products.find((entry) => refId(entry) === line.productId);
    if (!product) throw new Error(`${line.title || "That item"} is not part of this combo`);
    usedItemIds.add(itemId);

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    return { productId: line.productId, size: hasVariants ? line.size || "" : "" };
  });

  if (!usedItemIds.size) throw new Error("Pick at least one item from your cart");
  return { rawSelections, usedItemIds: [...usedItemIds] };
};

const productFields =
  "title price salePrice saleStartAt saleEndAt minPrice currency category variants stock images thumbnail isActive";

export const findCombosForProducts = (productIds = []) => {
  if (!productIds.length) return Promise.resolve([]);
  return ComboPack.find({
    status: "ACTIVE",
    $or: [
      { "items.product": { $in: productIds } },
      { "selectionGroups.eligibleProducts": { $in: productIds } },
    ],
  })
    .populate({ path: "items.product", select: productFields })
    .populate({ path: "selectionGroups.category", select: "name" })
    .populate({ path: "selectionGroups.eligibleProducts", select: productFields })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
};

export const getComboSuggestions = async ({ lines = [], limit = 2 }) => {
  const productIds = [...new Set(lines.map((line) => line.productId).filter(Boolean))];
  const combos = await findCombosForProducts(productIds);
  return buildComboSuggestions({ lines, combos, limit });
};
