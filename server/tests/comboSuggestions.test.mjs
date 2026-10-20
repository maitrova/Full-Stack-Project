import test from "node:test";
import assert from "node:assert/strict";
import {
  buildComboSuggestions,
  resolveConvertSelections,
  toComboLine,
} from "../services/comboSuggestionService.js";

// Combos are passed in already populated, so no MongoDB connection is needed.
const product = (id, price, extra = {}) => ({
  _id: id,
  title: `Product ${id}`,
  price,
  isActive: true,
  variants: [
    { size: "M", stock: 5 },
    { size: "L", stock: 2 },
  ],
  ...extra,
});

const tee = product("tee", 699);
const shorts = product("shorts", 599);
const pricyShorts = product("shorts-pro", 899);
const cap = product("cap", 299);
const soldOutShorts = product("shorts-out", 799, { variants: [{ size: "M", stock: 0 }] });

const group = (id, label, products, sortOrder) => ({
  _id: id,
  label,
  sortOrder,
  eligibleProducts: products,
});

const teeShortsCombo = {
  _id: "combo-1",
  name: "Summer Combo",
  slug: "summer-combo",
  status: "ACTIVE",
  comboPrice: 999,
  selectionGroups: [
    group("g-tee", "T-shirts", [tee], 0),
    group("g-shorts", "Shorts", [shorts, pricyShorts, soldOutShorts], 1),
  ],
};

const line = (itemId, productId, unitPrice, extra = {}) => ({
  itemId,
  kind: "READYMADE",
  productId,
  title: `Product ${productId}`,
  size: "M",
  qty: 1,
  unitPrice,
  ...extra,
});

test("one piece missing: suggests in-stock products with their saving", () => {
  const [suggestion] = buildComboSuggestions({
    lines: [line("i1", "tee", 699)],
    combos: [teeShortsCombo],
  });

  assert.equal(suggestion.type, "ADD_ONE");
  assert.equal(suggestion.comboSlug, "summer-combo");
  assert.deepEqual(suggestion.matched.map((m) => m.itemId), ["i1"]);
  assert.deepEqual(suggestion.missingSlots, [{ slotId: "g-shorts", label: "Shorts" }]);
  // 699 + 899 - 999 = 599 and 699 + 599 - 999 = 299; sold out shorts are skipped.
  assert.deepEqual(suggestion.candidates.map((c) => [c._id, c.savings]), [
    ["shorts-pro", 599],
    ["shorts", 299],
  ]);
  assert.equal(suggestion.savings, 599);
  assert.deepEqual(suggestion.candidates[1].sizes.map((s) => s.size), ["M", "L"]);
});

test("products that would not save money are not suggested", () => {
  const combo = { ...teeShortsCombo, comboPrice: 1400 };
  const [suggestion] = buildComboSuggestions({ lines: [line("i1", "tee", 699)], combos: [combo] });
  assert.deepEqual(suggestion.candidates.map((c) => c._id), ["shorts-pro"]);
  assert.equal(suggestion.savings, 198);

  const none = buildComboSuggestions({ lines: [line("i1", "tee", 699)], combos: [{ ...combo, comboPrice: 2000 }] });
  assert.deepEqual(none, []);
});

test("every piece already in the cart: offers a switch with the exact saving", () => {
  const [suggestion] = buildComboSuggestions({
    lines: [line("i1", "tee", 699), line("i2", "shorts", 599)],
    combos: [teeShortsCombo],
  });
  assert.equal(suggestion.type, "SWITCH");
  assert.equal(suggestion.savings, 299);
  assert.deepEqual(suggestion.missingSlots, []);
  assert.deepEqual(suggestion.matched.map((m) => m.slotId), ["g-tee", "g-shorts"]);
});

test("two or more pieces missing: links to the combo with the best reachable saving", () => {
  const combo = {
    ...teeShortsCombo,
    comboPrice: 1299,
    selectionGroups: [...teeShortsCombo.selectionGroups, group("g-cap", "Caps", [cap], 2)],
  };
  const [suggestion] = buildComboSuggestions({ lines: [line("i1", "tee", 699)], combos: [combo] });
  assert.equal(suggestion.type, "COMPLETE");
  assert.deepEqual(suggestion.missingSlots.map((s) => s.label), ["Shorts", "Caps"]);
  assert.equal(suggestion.savings, 598); // 699 + 899 + 299 - 1299
  assert.deepEqual(suggestion.candidates, []);
});

test("design, combo and drop lines never match a combo", () => {
  const lines = [
    toComboLine({ _id: "d1", kind: "DESIGN", qty: 1, unitPrice: 699 }),
    toComboLine({ _id: "c1", kind: "COMBO", qty: 1, unitPrice: 999 }),
  ];
  assert.deepEqual(buildComboSuggestions({ lines, combos: [teeShortsCombo] }), []);
});

test("older combos with fixed items work as one-product slots", () => {
  const legacy = {
    _id: "combo-legacy",
    name: "Tee + Cap",
    slug: "tee-cap",
    status: "ACTIVE",
    comboPrice: 899,
    items: [
      { product: tee, sortOrder: 0 },
      { product: cap, sortOrder: 1 },
    ],
  };
  const [suggestion] = buildComboSuggestions({ lines: [line("i1", "tee", 699)], combos: [legacy] });
  assert.equal(suggestion.type, "ADD_ONE");
  assert.equal(suggestion.missingSlots[0].slotId, "item-1");
  assert.deepEqual(suggestion.candidates.map((c) => [c._id, c.savings]), [["cap", 99]]);
});

test("a cart line fills only one slot, and inactive combos are ignored", () => {
  const sameProductTwice = {
    ...teeShortsCombo,
    _id: "combo-2",
    slug: "double",
    comboPrice: 1000,
    allowDuplicateProducts: true,
    selectionGroups: [group("a", "First", [tee], 0), group("b", "Second", [tee], 1)],
  };
  const [suggestion] = buildComboSuggestions({
    lines: [line("i1", "tee", 699)],
    combos: [sameProductTwice, { ...teeShortsCombo, status: "INACTIVE" }],
  });
  assert.equal(suggestion.comboId, "combo-2");
  assert.equal(suggestion.type, "ADD_ONE");
  assert.equal(suggestion.matched.length, 1);
});

test("best savings first, capped at the limit", () => {
  const cheaper = { ...teeShortsCombo, _id: "combo-cheap", slug: "cheap", comboPrice: 799 };
  const pricier = { ...teeShortsCombo, _id: "combo-pricey", slug: "pricey", comboPrice: 1199 };
  const result = buildComboSuggestions({
    lines: [line("i1", "tee", 699)],
    combos: [pricier, teeShortsCombo, cheaper],
  });
  assert.deepEqual(result.map((s) => s.comboSlug), ["cheap", "summer-combo"]);
});

test("toComboLine reads populated cart items", () => {
  const result = toComboLine({
    _id: "item-1",
    kind: "READYMADE",
    qty: 2,
    size: "L",
    unitPrice: 499,
    readymadeProduct: { _id: "abc", title: "Black Tee" },
  });
  assert.deepEqual(result, {
    itemId: "item-1",
    kind: "READYMADE",
    productId: "abc",
    title: "Black Tee",
    size: "L",
    qty: 2,
    unitPrice: 499,
  });
});

// --- convert to combo ---

const cartLine = (itemId, productId, size = "M") => ({ itemId, productId, title: `Product ${productId}`, size });

test("convert: cart item plus a new product become selections in slot order", () => {
  const result = resolveConvertSelections({
    combo: teeShortsCombo,
    cartLines: [cartLine("i1", "tee", "L")],
    selections: [
      { slotId: "g-shorts", productId: "shorts", size: "M" },
      { slotId: "g-tee", itemId: "i1" },
    ],
  });
  assert.deepEqual(result.rawSelections, [
    { productId: "tee", size: "L" },
    { productId: "shorts", size: "M", color: "" },
  ]);
  assert.deepEqual(result.usedItemIds, ["i1"]);
});

test("convert: switching two cart items uses both", () => {
  const result = resolveConvertSelections({
    combo: teeShortsCombo,
    cartLines: [cartLine("i1", "tee"), cartLine("i2", "shorts", "L")],
    selections: [
      { slotId: "g-tee", itemId: "i1" },
      { slotId: "g-shorts", itemId: "i2" },
    ],
  });
  assert.deepEqual(result.usedItemIds, ["i1", "i2"]);
  assert.equal(result.rawSelections[1].size, "L");
});

test("convert: products without sizes drop the cart's default size", () => {
  const plainCap = product("cap-plain", 299, { variants: [], stock: 4 });
  const legacy = {
    _id: "combo-legacy",
    status: "ACTIVE",
    comboPrice: 899,
    items: [{ product: tee }, { product: plainCap }],
  };
  const result = resolveConvertSelections({
    combo: legacy,
    cartLines: [cartLine("i1", "cap-plain", "M")],
    selections: [
      { slotId: "item-0", productId: "tee", size: "M" },
      { slotId: "item-1", itemId: "i1" },
    ],
  });
  assert.deepEqual(result.rawSelections[1], { productId: "cap-plain", size: "" });
});

test("convert: rejects bad requests with a readable message", () => {
  const run = (selections, cartLines = [cartLine("i1", "tee"), cartLine("i2", "cap")]) => () =>
    resolveConvertSelections({ combo: teeShortsCombo, cartLines, selections });

  assert.throws(run([{ slotId: "g-tee", itemId: "i1" }]), /Choose a Shorts/);
  assert.throws(run([{ slotId: "nope", itemId: "i1" }]), /does not match this combo/);
  assert.throws(
    run([{ slotId: "g-tee", itemId: "i1" }, { slotId: "g-tee", itemId: "i1" }]),
    /only be chosen once/
  );
  assert.throws(
    run([{ slotId: "g-tee", itemId: "gone" }, { slotId: "g-shorts", productId: "shorts" }]),
    /no longer in your cart/
  );
  assert.throws(
    run([{ slotId: "g-tee", itemId: "i2" }, { slotId: "g-shorts", productId: "shorts" }]),
    /not part of this combo/
  );
  assert.throws(
    run([{ slotId: "g-tee", productId: "tee" }, { slotId: "g-shorts", productId: "shorts" }]),
    /at least one item from your cart/
  );
});
