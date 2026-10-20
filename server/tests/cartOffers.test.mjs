import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCartOffers,
  getTierDiscount,
  toOfferLine,
} from "../services/cartOfferService.js";

// Rules are passed in directly, so no MongoDB connection is needed.
const spendRule = {
  _id: "rule-spend",
  name: "Spend more, save more",
  stackWithCoupons: true,
  includeSaleItems: true,
  includeComboPacks: false,
  allowedCategories: [],
  excludedProducts: [],
  tiers: [
    { minCartAmount: 1999, discountType: "PERCENTAGE", discountValue: 10 },
    { minCartAmount: 999, discountType: "PERCENTAGE", discountValue: 5 },
  ],
};

const line = (lineTotal, extra = {}) => ({
  kind: "READYMADE",
  productId: `p-${lineTotal}`,
  categoryId: "tees",
  lineTotal,
  saleActive: false,
  ...extra,
});

test("below every tier: no discount, nudges to the first tier", async () => {
  const result = await evaluateCartOffers({ lines: [line(699)], rules: [spendRule] });
  assert.equal(result.discount, 0);
  assert.equal(result.applied, null);
  assert.equal(result.nextUnlock.gapAmount, 300);
  assert.equal(result.nextUnlock.targetAmount, 999);
  assert.equal(result.nextUnlock.progressPercent, 70);
});

test("crossing a tier applies it and points at the next one", async () => {
  const result = await evaluateCartOffers({ lines: [line(699), line(199), line(149)], rules: [spendRule] });
  assert.equal(result.discount, 52); // 5% of 1047, rounded down
  assert.equal(result.applied.minCartAmount, 999);
  assert.equal(result.nextUnlock.gapAmount, 952);
  assert.equal(result.offers[0].isApplied, true);
});

test("highest tier reached: no further nudge", async () => {
  const result = await evaluateCartOffers({ lines: [line(2500)], rules: [spendRule] });
  assert.equal(result.discount, 250);
  assert.equal(result.nextUnlock, null);
});

test("combo packs and sale items are excluded when the rule says so", async () => {
  const rule = { ...spendRule, includeSaleItems: false };
  const result = await evaluateCartOffers({
    lines: [line(800), line(900, { kind: "COMBO" }), line(700, { saleActive: true })],
    rules: [rule],
  });
  assert.equal(result.offers[0].eligibleAmount, 800);
  assert.equal(result.discount, 0);
});

test("category limited rules only count matching items", async () => {
  const rule = { ...spendRule, allowedCategories: ["hoodies"] };
  const result = await evaluateCartOffers({
    lines: [line(1500, { categoryId: "hoodies" }), line(1500)],
    rules: [rule],
  });
  assert.equal(result.offers[0].eligibleAmount, 1500);
  assert.equal(result.discount, 75);
});

test("non-stackable rule is skipped when a coupon is used", async () => {
  const rule = { ...spendRule, stackWithCoupons: false };
  const result = await evaluateCartOffers({ lines: [line(2500)], rules: [rule], couponApplied: true });
  assert.equal(result.discount, 0);
  assert.equal(result.offers[0].blockedByCoupon, true);
  assert.equal(result.nextUnlock, null);
});

test("best discount wins across rules", async () => {
  const flatRule = {
    ...spendRule,
    _id: "rule-flat",
    name: "Flat 300",
    tiers: [{ minCartAmount: 1500, discountType: "FIXED_AMOUNT", discountValue: 300 }],
  };
  const result = await evaluateCartOffers({ lines: [line(2000)], rules: [spendRule, flatRule] });
  assert.equal(result.applied.ruleId, "rule-flat");
  assert.equal(result.discount, 300);
});

test("percentage cap and rounding", () => {
  const tier = { discountType: "PERCENTAGE", discountValue: 15, maximumDiscountAmount: 200 };
  assert.equal(getTierDiscount(tier, 1000), 150);
  assert.equal(getTierDiscount(tier, 5000), 200);
  assert.equal(getTierDiscount({ discountType: "PERCENTAGE", discountValue: 5 }, 1047), 52);
});

test("toOfferLine reads populated and plain cart items", () => {
  const populated = toOfferLine({
    kind: "READYMADE",
    qty: 2,
    unitPrice: 499,
    readymadeProduct: { _id: "abc", category: { _id: "tees", name: "Tees" } },
    priceDetails: { saleActive: true },
  });
  assert.deepEqual(populated, {
    kind: "READYMADE",
    productId: "abc",
    categoryId: "tees",
    lineTotal: 998,
    saleActive: true,
  });

  const combo = toOfferLine({ kind: "COMBO", qty: 1, unitPrice: 999 });
  assert.equal(combo.productId, "");
  assert.equal(combo.lineTotal, 999);
});
