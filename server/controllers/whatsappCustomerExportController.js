import mongoose from "mongoose";
import XLSX from "xlsx";
import Order from "../models/Order.js";
import Address from "../models/address.js";

const EXPORT_LIMIT = 5000;

const lastTen = (phone) => String(phone || "").replace(/\D/g, "").slice(-10);

const phoneVariants = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  const ten = digits.slice(-10);
  if (ten.length < 10) return [];
  return [...new Set([digits, `+${digits}`, ten, `91${ten}`, `+91${ten}`, `0${ten}`])];
};

// Shown in IST so the sheet matches what the team sees in the inbox.
const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + 330 * 60 * 1000).toISOString().replace("T", " ").slice(0, 16);
};

const formatAddress = (address) => (address
  ? [address.completeAddress, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(", ")
  : "");

// Product names live on whichever catalogue the item came from.
const loadProductNames = async (orders) => {
  const sources = { readymadeProduct: "ReadymadeProduct", dropproduct: "Dropproduct", design: "Design" };
  const names = new Map();
  await Promise.all(Object.entries(sources).map(async ([field, modelName]) => {
    const collection = mongoose.models[modelName]?.collection;
    if (!collection) return;
    const ids = [...new Set(orders.flatMap((order) => (order.items || []).map((item) => item[field]).filter(Boolean).map(String)))];
    if (!ids.length) return;
    const rows = await collection
      .find({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } }, { projection: { title: 1, name: 1, productName: 1 } })
      .toArray();
    rows.forEach((row) => names.set(String(row._id), row.title || row.name || row.productName || ""));
  }));
  return names;
};

const itemName = (item, names) => {
  const id = item.readymadeProduct || item.dropproduct || item.design;
  return (id && names.get(String(id))) || item.comboName || item.kind || "Item";
};

const sheetFrom = (rows, headers) => {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  sheet["!cols"] = headers.map((header) => ({
    wch: Math.min(60, Math.max(header.length, ...rows.map((row) => String(row[header] ?? "").length)) + 2),
  }));
  return sheet;
};

export const exportWhatsAppCustomers = async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  try {
    const database = mongoose.connection.db;
    const conversations = await database.collection("conversations")
      .find(
        { channel: "whatsapp" },
        {
          projection: {
            external_customer_ref: 1, customer_name: 1, status: 1, lead_type: 1, lead_status: 1,
            created_at: 1, last_message_at: 1, conversation_state: 1,
          },
        },
      )
      .sort({ last_message_at: -1, created_at: -1 })
      .limit(EXPORT_LIMIT)
      .toArray();

    const phones = [...new Set(conversations.map((row) => row.external_customer_ref).filter(Boolean).map(String))];

    // A finished WhatsApp checkout link is the reliable phone -> account mapping.
    const subscriptions = await database.collection("whatsapp_order_subscriptions")
      .find({ recipient: { $in: phones } }, { projection: { recipient: 1, user: 1, updatedAt: 1 } })
      .sort({ updatedAt: 1 })
      .toArray();
    const userIdByPhone = new Map();
    subscriptions.forEach((row) => { if (row.user) userIdByPhone.set(String(row.recipient), String(row.user)); });

    // Otherwise match the account's saved phone number on its last 10 digits.
    const unmatched = phones.filter((phone) => !userIdByPhone.has(phone));
    const variants = unmatched.flatMap(phoneVariants);
    if (variants.length) {
      const users = await database.collection("users")
        .find({ phone: { $in: variants } }, { projection: { phone: 1 } })
        .toArray();
      const byTen = new Map(users.map((user) => [lastTen(user.phone), String(user._id)]));
      unmatched.forEach((phone) => {
        const match = byTen.get(lastTen(phone));
        if (match) userIdByPhone.set(phone, match);
      });
    }

    const userIds = [...new Set(userIdByPhone.values())].map((id) => new mongoose.Types.ObjectId(id));
    const [users, orders, addresses] = await Promise.all([
      database.collection("users")
        .find({ _id: { $in: userIds } }, { projection: { name: 1, email: 1, phone: 1, createdAt: 1 } })
        .toArray(),
      Order.find({ user: { $in: userIds } }).sort({ createdAt: -1 }).lean(),
      Address.find({ user: { $in: userIds } }).sort({ type: 1, isDefault: -1, createdAt: -1 }).lean(),
    ]);

    const userById = new Map(users.map((user) => [String(user._id), user]));
    const addressById = new Map(addresses.map((address) => [String(address._id), address]));
    const ordersByUser = new Map();
    orders.forEach((order) => {
      const key = String(order.user);
      if (!ordersByUser.has(key)) ordersByUser.set(key, []);
      ordersByUser.get(key).push(order);
    });
    const productNames = await loadProductNames(orders);

    const customerRows = [];
    const orderRows = [];
    const addressRows = [];
    const exportedUsers = new Set();

    for (const conversation of conversations) {
      const phone = String(conversation.external_customer_ref || "");
      const userId = userIdByPhone.get(phone);
      const user = userId ? userById.get(userId) : null;
      const userOrders = userId ? ordersByUser.get(userId) || [] : [];
      const paidOrders = userOrders.filter((order) => order.status === "PAID");
      const customerName = conversation.customer_name || user?.name || "";
      const leadType = conversation.lead_type
        || (conversation.conversation_state?.customization_interest ? "customization" : "");

      customerRows.push({
        "WhatsApp Name": conversation.customer_name || "",
        "WhatsApp Phone": phone,
        "Store Account Linked": user ? "Yes" : "No",
        "Account Name": user?.name || "",
        "Account Email": user?.email || "",
        "Account Phone": user?.phone || "",
        "Account Created": formatDate(user?.createdAt),
        "Lead Type": leadType || "",
        "Lead Status": conversation.lead_status || "",
        "Chat Status": conversation.status || "",
        "First Contact": formatDate(conversation.created_at),
        "Last Message": formatDate(conversation.last_message_at),
        "Total Orders": userOrders.length,
        "Paid Orders": paidOrders.length,
        "Total Spent (INR)": paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      });

      // Several chats can belong to one account; list its orders and addresses once.
      if (!userId || exportedUsers.has(userId)) continue;
      exportedUsers.add(userId);

      for (const order of userOrders) {
        orderRows.push({
          "WhatsApp Phone": phone,
          "Customer Name": customerName,
          "Order ID": String(order._id),
          "Order Date": formatDate(order.createdAt),
          "Payment Status": order.status || "",
          "Order Status": order.orderStatus || "",
          "Items": (order.items || [])
            .map((item) => `${itemName(item, productNames)}${item.size ? ` (${item.size})` : ""} x ${item.qty || 0}`)
            .join("; "),
          "Subtotal": Number(order.subtotal || 0),
          "Discount": Number(order.discount || 0),
          "Shipping": Number(order.shipping || 0),
          "Total": Number(order.total || 0),
          "Currency": order.currency || "INR",
          "Coupon": order.coupon?.code || "",
          "Return Status": order.returnRequest?.status && order.returnRequest.status !== "NONE" ? order.returnRequest.status : "",
          "Delivery Address": formatAddress(addressById.get(String(order.deliveryAddress))),
        });
      }

      for (const address of addresses.filter((row) => String(row.user) === userId)) {
        addressRows.push({
          "WhatsApp Phone": phone,
          "Customer Name": customerName,
          "Type": address.type === "billing" ? "Billing" : "Delivery",
          "Full Name": address.fullName || "",
          "Mobile": address.mobileNumber || "",
          "Address": address.completeAddress || "",
          "Landmark": address.landmark || "",
          "City": address.city || "",
          "State": address.state || "",
          "Pincode": address.pincode || "",
          "Default": address.isDefault ? "Yes" : "No",
        });
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheetFrom(customerRows, [
      "WhatsApp Name", "WhatsApp Phone", "Store Account Linked", "Account Name", "Account Email", "Account Phone",
      "Account Created", "Lead Type", "Lead Status", "Chat Status", "First Contact", "Last Message",
      "Total Orders", "Paid Orders", "Total Spent (INR)",
    ]), "Customers");
    XLSX.utils.book_append_sheet(workbook, sheetFrom(orderRows, [
      "WhatsApp Phone", "Customer Name", "Order ID", "Order Date", "Payment Status", "Order Status", "Items",
      "Subtotal", "Discount", "Shipping", "Total", "Currency", "Coupon", "Return Status", "Delivery Address",
    ]), "Orders");
    XLSX.utils.book_append_sheet(workbook, sheetFrom(addressRows, [
      "WhatsApp Phone", "Customer Name", "Type", "Full Name", "Mobile", "Address", "Landmark", "City", "State",
      "Pincode", "Default",
    ]), "Addresses");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const filename = `whatsapp-customers-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(buffer);
  } catch (error) {
    console.error("WhatsApp customer export failed:", error.message);
    return res.status(500).json({ message: "Could not export WhatsApp customers" });
  }
};
