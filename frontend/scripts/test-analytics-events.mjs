import assert from "node:assert/strict";
import {
  trackAddPaymentInfo,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
} from "../src/utils/analytics.js";

const sampleItems = [
  {
    _id: "cart-item-1",
    kind: "READYMADE",
    qty: 2,
    size: "M",
    unitPrice: 499,
    currency: "INR",
    readymadeProduct: {
      _id: "product-1",
      title: "Classic Tee",
      category: "T-Shirts",
      currency: "INR",
    },
  },
];

const resetWindow = () => {
  global.window = {
    dataLayer: [],
    gtagCalls: [],
    gtag(...args) {
      this.gtagCalls.push(args);
    },
  };
};

const lastDataLayerEvent = () =>
  window.dataLayer.findLast((entry) => entry?.event);

const assertEcommerceEvent = (expectedEvent, expectedValue) => {
  const dataLayerEvent = lastDataLayerEvent();
  assert.equal(dataLayerEvent.event, expectedEvent);
  assert.equal(dataLayerEvent.ecommerce.currency, "INR");
  assert.equal(dataLayerEvent.ecommerce.value, expectedValue);
  assert.equal(dataLayerEvent.ecommerce.items.length, 1);
  assert.equal(dataLayerEvent.ecommerce.items[0].item_id, "product-1");
  assert.equal(dataLayerEvent.ecommerce.items[0].item_name, "Classic Tee");
  assert.equal(dataLayerEvent.ecommerce.items[0].item_category, "T-Shirts");
  assert.equal(dataLayerEvent.ecommerce.items[0].item_variant, "M");
  assert.equal(dataLayerEvent.ecommerce.items[0].price, 499);
  assert.equal(dataLayerEvent.ecommerce.items[0].quantity, 2);

  const [command, eventName, payload] = window.gtagCalls.at(-1);
  assert.equal(command, "event");
  assert.equal(eventName, expectedEvent);
  assert.equal(payload.currency, "INR");
  assert.equal(payload.value, expectedValue);
  assert.equal(payload.items.length, 1);
};

resetWindow();
trackAddToCart({ items: sampleItems, value: 998, currency: "INR" });
assertEcommerceEvent("add_to_cart", 998);

resetWindow();
trackBeginCheckout({ items: sampleItems, value: 998, currency: "INR" });
assertEcommerceEvent("begin_checkout", 998);

resetWindow();
trackAddPaymentInfo({
  items: sampleItems,
  value: 998,
  currency: "INR",
  paymentType: "Online payment",
});
assertEcommerceEvent("add_payment_info", 998);
assert.equal(lastDataLayerEvent().ecommerce.payment_type, "Online payment");

resetWindow();
trackPurchase({
  transactionId: "order-1",
  items: sampleItems,
  value: 998,
  currency: "INR",
  paymentType: "Online payment",
});
assertEcommerceEvent("purchase", 998);
assert.equal(lastDataLayerEvent().ecommerce.transaction_id, "order-1");

console.log("GA4 ecommerce analytics smoke test passed");
