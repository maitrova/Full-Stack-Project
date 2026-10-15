// Seed orders in different states for testing AI order tracking.
// Needs the products from seedAiTestProducts.js.
//
//   node scripts/seedAiTestOrders.js [--email you@example.com]  add test orders
//   node scripts/seedAiTestOrders.js --remove                    delete them
//
// Only runs against a local MongoDB unless --allow-remote is passed.
// Orders are tagged with an "AI-TEST-" invoice number and addresses with the
// name "AI Test Address", so --remove deletes exactly these.
import "dotenv/config";
import mongoose from "mongoose";

import Order from "../models/Order.js";
import Address from "../models/address.js";
import ReadymadeProduct from "../models/readymadeproducts.js";
import Dropproduct from "../models/dropproduct.model.js";

const TAG = "AI-TEST-";
const ADDRESS_NAME = "AI Test Address";
// Guests verify with this delivery mobile number (or the account email/phone).
const TEST_MOBILE = "9000012345";
const DAY = 24 * 60 * 60 * 1000;

const argValue = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
};
const isLocal = (url) => /mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url || "");
const daysAgo = (days, hours = 0) => new Date(Date.now() - days * DAY - hours * 60 * 60 * 1000);

async function findProduct(model, field, value) {
  const product = await model.findOne({ [field]: value });
  if (!product) throw new Error(`Missing test product "${value}". Run seedAiTestProducts.js first.`);
  return product;
}

const readymadeItem = (product, size, qty = 1) => {
  const unitPrice = product.salePrice || product.price;
  return { kind: "READYMADE", readymadeProduct: product._id, size, qty, unitPrice, basePrice: product.price, currency: "INR", previewImage: product.thumbnail };
};
const dropItem = (product, size, qty = 1) => {
  const unitPrice = product.salePrice || product.minPrice;
  return { kind: "DROPPRODUCT", dropproduct: product._id, size, qty, unitPrice, basePrice: product.minPrice, currency: "INR" };
};
const history = (...steps) => steps.map(([status, at]) => ({ status, at }));

async function seed() {
  const email = argValue("--email");
  const User = mongoose.connection.collection("users");
  const user = email ? await User.findOne({ email }) : await User.findOne({});
  if (!user) throw new Error(email ? `No user with email ${email}` : "No users found. Create an account first.");

  const [blackTee, whiteTee, hoodie, kurta, linen] = await Promise.all([
    findProduct(ReadymadeProduct, "title", "Oversized Black Cotton T-Shirt"),
    findProduct(ReadymadeProduct, "title", "Classic White Crew Neck T-Shirt"),
    findProduct(ReadymadeProduct, "title", "Charcoal Fleece Hoodie"),
    findProduct(ReadymadeProduct, "title", "White Chikankari Kurta"),
    findProduct(ReadymadeProduct, "title", "Sky Blue Linen Shirt"),
  ]);
  const [galaxy, racer] = await Promise.all([
    findProduct(Dropproduct, "name", "Galaxy Oversized Tee - Drop 01"),
    findProduct(Dropproduct, "name", "Retro Racer Hoodie - Drop 01"),
  ]);

  await remove({ quiet: true });
  const addressFields = {
    user: user._id, fullName: ADDRESS_NAME, mobileNumber: TEST_MOBILE,
    completeAddress: "12 Test Street, Madhapur", pincode: "500081", city: "Hyderabad", state: "Telangana",
  };
  const delivery = await Address.create({ ...addressFields, type: "delivery" });
  const billing = await Address.create({ ...addressFields, type: "billing" });

  const orders = [
    {
      label: "being prepared", createdAt: daysAgo(0, 3),
      items: [readymadeItem(blackTee, "L"), readymadeItem(whiteTee, "M", 2)],
      status: "PAID", orderStatus: "PROCESSING", payment: { method: "RAZORPAY", status: "CAPTURED" },
      statusHistory: history(["PROCESSING", daysAgo(0, 3)]),
    },
    {
      label: "shipped", createdAt: daysAgo(3),
      items: [readymadeItem(hoodie, "XL")],
      status: "PAID", orderStatus: "SHIPPED", payment: { method: "RAZORPAY", status: "CAPTURED" },
      statusHistory: history(["PROCESSING", daysAgo(3)], ["READY", daysAgo(2)], ["SHIPPED", daysAgo(1)]),
    },
    {
      label: "delivered", createdAt: daysAgo(10),
      items: [readymadeItem(kurta, "M")],
      status: "PAID", orderStatus: "DELIVERED", payment: { method: "COD", status: "COLLECTED" },
      statusHistory: history(["PROCESSING", daysAgo(10)], ["READY", daysAgo(9)], ["SHIPPED", daysAgo(8)], ["DELIVERED", daysAgo(5)]),
      deliveredAt: daysAgo(5),
    },
    {
      label: "return in progress", createdAt: daysAgo(6),
      items: [readymadeItem(linen, "L")],
      status: "PAID", orderStatus: "DELIVERED", payment: { method: "RAZORPAY", status: "CAPTURED" },
      statusHistory: history(["PROCESSING", daysAgo(6)], ["SHIPPED", daysAgo(4)], ["DELIVERED", daysAgo(1, 6)]),
      deliveredAt: daysAgo(1, 6),
      returnRequest: { status: "PROCESSING", requestedAt: daysAgo(0, 20), reason: "Size received is different from order", refundStatus: "NOT_PAID" },
    },
    {
      label: "cancelled, refund processing", createdAt: daysAgo(4),
      items: [dropItem(galaxy, "M")],
      status: "CANCELLED", orderStatus: "PROCESSING",
      payment: { method: "RAZORPAY", status: "CAPTURED", refundStatus: "PROCESSING", refundAmount: galaxy.salePrice || galaxy.minPrice, refundInitiatedAt: daysAgo(3) },
      statusHistory: history(["PROCESSING", daysAgo(4)], ["CANCELLED", daysAgo(3)]),
      cancelledAt: daysAgo(3), cancelledByRole: "CUSTOMER", cancellationReason: "Ordered the wrong size",
    },
    {
      label: "payment failed", createdAt: daysAgo(2),
      items: [dropItem(racer, "L")],
      status: "FAILED", orderStatus: "PROCESSING",
      payment: { method: "RAZORPAY", status: "FAILED", failureReason: "Payment was declined by the bank" },
      statusHistory: history(["PENDING_PAYMENT", daysAgo(2)], ["FAILED", daysAgo(2)]),
    },
  ];

  for (const [index, { label, createdAt, ...fields }] of orders.entries()) {
    const subtotal = fields.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
    const order = await Order.create({
      ...fields, user: user._id, deliveryAddress: delivery._id, billingAddress: billing._id,
      subtotal, shipping: 0, discount: 0, total: subtotal, currency: "INR",
      invoiceNumber: `${TAG}${index + 1}`,
    });
    // Backdate after create; Mongoose timestamps would otherwise use "now".
    await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt, updatedAt: createdAt } });
    console.log(`#${String(order._id).slice(-8).toUpperCase()}  ${label}`);
  }
  console.log(`\nSeeded ${orders.length} orders for ${user.email}.`);
  console.log(`Guests can verify with an order number above plus ${user.email} or mobile ${TEST_MOBILE}.`);
}

async function remove({ quiet = false } = {}) {
  const orders = await Order.deleteMany({ invoiceNumber: { $regex: `^${TAG}` } });
  const addresses = await Address.deleteMany({ fullName: ADDRESS_NAME });
  if (!quiet) console.log(`Removed ${orders.deletedCount} test orders and ${addresses.deletedCount} test addresses.`);
}

const url = process.env.MONGOOSE_URL;
if (!isLocal(url) && !process.argv.includes("--allow-remote")) {
  console.error("Refusing to seed: MONGOOSE_URL is not a local MongoDB. Pass --allow-remote to override.");
  process.exit(1);
}

try {
  await mongoose.connect(url);
  if (process.argv.includes("--remove")) await remove();
  else await seed();
} catch (error) {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
