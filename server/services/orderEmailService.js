import Order from "../models/Order.js";
import {
  getBrevoTemplateId,
  sendBrevoEmail,
} from "./brevoEmailService.js";

const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const subjectMap = {
  PROCESSING: "Order Confirmed",
  READY: "Your Order is Ready",
  SHIPPED: "Your Order Has Been Shipped",
  DELIVERED: "Order Delivered",
};

const ORDER_EMAIL_POPULATE = [
  { path: "user", select: "name email phone" },
  { path: "deliveryAddress" },
  { path: "billingAddress" },
  { path: "items.readymadeProduct", select: "title" },
  { path: "items.design", select: "title productName" },
  { path: "items.dropproduct", select: "name" },
  { path: "items.product", select: "name" },
];

const formatAmount = (value) => Number(value || 0).toFixed(2);
const formatCurrencyAmount = (value, currency = "INR") =>
  `${currency === "INR" ? "Rs." : `${currency} `}${formatAmount(value)}`;

const getEmailAssetBaseUrl = () =>
  String(
    process.env.EMAIL_ASSET_BASE_URL ||
      process.env.API_URL ||
      process.env.BACKEND_URL ||
      "https://maitrova.in"
  )
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");

const resolveEmailImageUrl = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  if (/^https?:\/\//i.test(rawValue)) {
    return rawValue;
  }

  const normalizedPath = rawValue.startsWith("/")
    ? rawValue
    : rawValue.startsWith("outputs/")
      ? `/api/${rawValue}`
      : rawValue.startsWith("api/")
        ? `/${rawValue}`
        : `/api/outputs/${rawValue.replace(/^\.?\/+/, "")}`;

  return `${getEmailAssetBaseUrl()}${normalizedPath}`;
};

const formatDateTime = (date) =>
  new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const resolvePaymentMethod = (order) => {
  if (order?.payment?.razorpayPaymentId || order?.payment?.razorpayOrderId) {
    return "Razorpay";
  }

  return "Online Payment";
};

const buildAddressText = (address) => {
  if (!address) return "";

  const parts = [
    address.fullName,
    address.mobileNumber,
    address.completeAddress,
    address.landmark,
    [address.city, address.state].filter(Boolean).join(", "),
    address.pincode,
  ].filter(Boolean);

  return parts.join(", ");
};

const buildItemsText = (items = []) =>
  items
    .map((item, index) => {
      const quantity = Number(item.qty || 0);
      const unitPrice = formatAmount(item.unitPrice);
      const size = item.size ? `, Size: ${item.size}` : "";
      return `${index + 1}. ${getItemName(item, index)}${size}, Qty: ${quantity}, Price: Rs.${unitPrice}`;
    })
    .join("\n");

const resolveOrderDateTime = (order) =>
  order.inventoryAdjustedAt || order.updatedAt || order.createdAt || new Date();

const getAdminRecipients = () => {
  const rawRecipients =
    process.env.ADMIN_NOTIFICATION_EMAILS ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.BREVO_ADMIN_NOTIFICATION_EMAIL ||
    process.env.BREVO_SENDER_EMAIL;

  if (!rawRecipients) {
    return [];
  }

  return rawRecipients
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({
      email,
      name: process.env.ADMIN_NOTIFICATION_NAME || "Maitrova Admin",
    }));
};

const getItemName = (item, index) => {
  if (item?.readymadeProduct?.title) {
    return item.readymadeProduct.title;
  }

  if (item?.design?.title || item?.design?.productName) {
    return item.design.title || item.design.productName;
  }

  if (item?.dropproduct?.name) {
    return item.dropproduct.name;
  }

  if (item?.product?.name) {
    return item.product.name;
  }

  return `Product ${index + 1}`;
};

const hydrateOrderForEmail = async (order, user) => {
  if (!order?._id) {
    return { order, user };
  }

  const populatedOrder = await Order.findById(order._id)
    .populate(ORDER_EMAIL_POPULATE)
    .lean();

  if (!populatedOrder) {
    return { order, user };
  }

  return {
    order: populatedOrder,
    user: populatedOrder.user || user,
  };
};

const buildItemsHtml = (items = []) =>
  items
    .map((item, index) => {
      const previewImageUrl = resolveEmailImageUrl(item.previewImage);
      return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          <img src="${previewImageUrl}" width="60" />
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          <strong>${getItemName(item, index)}</strong><br/>
          Size: ${item.size || "-"}<br/>
          Qty: ${item.qty || 0}
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">
          Rs.${formatAmount(item.unitPrice)}
        </td>
      </tr>
    `;
    })
    .join("");

const buildOrderTemplateParams = (order, user, itemsHtml, orderDate) => {
  const normalizedItems = (order.items || []).map((item, index) => ({
    index: index + 1,
    name: getItemName(item, index),
    previewImage: resolveEmailImageUrl(item.previewImage),
    size: item.size || "",
    quantity: Number(item.qty || 0),
    unitPrice: formatAmount(item.unitPrice),
    currency: item.currency || order.currency || "INR",
  }));

  const params = {
    customerName: user?.name || "",
    customer_name: user?.name || "",
    customerEmail: user?.email || "",
    customer_email: user?.email || "",
    orderId: String(order._id || ""),
    order_id: String(order._id || ""),
    orderStatus: order.orderStatus || "",
    order_status: order.orderStatus || "",
    orderDate: orderDate || "",
    order_date: orderDate || "",
    subtotal: formatAmount(order.subtotal),
    subtotal_amount: formatAmount(order.subtotal),
    shipping: formatAmount(order.shipping),
    shipping_amount: formatAmount(order.shipping),
    discount: formatAmount(order.discount),
    discount_amount: formatAmount(order.discount),
    total: formatAmount(order.total),
    total_amount: formatAmount(order.total),
    currency: order.currency || "INR",
    items: normalizedItems,
    itemsHtml,
    items_html: itemsHtml,
    shippedMessage:
      order.orderStatus === "SHIPPED"
        ? "Your order is on the way! You will receive it soon."
        : "",
    shipped_message:
      order.orderStatus === "SHIPPED"
        ? "Your order is on the way! You will receive it soon."
        : "",
    deliveredMessage:
      order.orderStatus === "DELIVERED"
        ? "We hope you love your purchase. Please leave a review."
        : "",
    delivered_message:
      order.orderStatus === "DELIVERED"
        ? "We hope you love your purchase. Please leave a review."
        : "",
  };

  normalizedItems.forEach((item) => {
    params[`product_name_${item.index}`] = item.name;
    params[`size_${item.index}`] = item.size;
    params[`qty_${item.index}`] = item.quantity;
    params[`price_${item.index}`] = item.unitPrice;
    params[`preview_image_${item.index}`] = item.previewImage;
  });

  return params;
};

const buildAdminOrderTemplateParams = (order, user) => {
  const orderDateTime = resolveOrderDateTime(order);
  const deliveryAddress = buildAddressText(order.deliveryAddress);
  const billingAddress = buildAddressText(order.billingAddress);
  const productsText = buildItemsText(order.items);
  const currency = order.currency || "INR";
  const normalizedItems = (order.items || []).map((item, index) => ({
    index: index + 1,
    name: getItemName(item, index),
    previewImage: resolveEmailImageUrl(item.previewImage),
    rawPreviewImage: item.previewImage || "",
    size: item.size || "",
    quantity: Number(item.qty || 0),
    unitPrice: formatCurrencyAmount(item.unitPrice, item.currency || currency),
  }));

  const params = {
    order_id: String(order._id || ""),
    order_datetime: formatDateTime(orderDateTime),
    order_status: order.orderStatus || order.status || "",
    customer_name:
      order.deliveryAddress?.fullName || order.billingAddress?.fullName || user?.name || "",
    customer_email: user?.email || "",
    customer_phone:
      order.deliveryAddress?.mobileNumber ||
      order.billingAddress?.mobileNumber ||
      user?.phone ||
      "",
    shipping_address: deliveryAddress,
    billing_address: billingAddress || deliveryAddress,
    payment_method: resolvePaymentMethod(order),
    payment_status: order.payment?.status || order.status || "",
    transaction_id: order.payment?.razorpayPaymentId || order.payment?.razorpayOrderId || "N/A",
    subtotal: formatCurrencyAmount(order.subtotal, currency),
    shipping: formatCurrencyAmount(order.shipping, currency),
    tax: formatCurrencyAmount(0, currency),
    discount: formatCurrencyAmount(order.discount, currency),
    total: formatCurrencyAmount(order.total, currency),
    products_text: productsText,
    items: normalizedItems,
  };

  normalizedItems.forEach((item) => {
    params[`product_name_${item.index}`] = item.name;
    params[`preview_image_${item.index}`] = item.previewImage;
    params[`preview_image_raw_${item.index}`] = item.rawPreviewImage;
    params[`size_${item.index}`] = item.size;
    params[`qty_${item.index}`] = item.quantity;
    params[`price_${item.index}`] = item.unitPrice;
  });

  return params;
};

export const sendOrderStatusEmail = async (order, user) => {
  const hydrated = await hydrateOrderForEmail(order, user);
  const emailOrder = hydrated.order || order;
  const emailUser = hydrated.user || user || {};
  const itemsHtml = buildItemsHtml(emailOrder.items);
  const subject = subjectMap[emailOrder.orderStatus] || "Order Update";
  const orderDate = formatDate(emailOrder.createdAt);
  const templateId = getBrevoTemplateId(
    `BREVO_ORDER_TEMPLATE_ID_${emailOrder.orderStatus}`,
    "BREVO_ORDER_TEMPLATE_ID"
  );
  const templateParams = buildOrderTemplateParams(
    emailOrder,
    emailUser,
    itemsHtml,
    orderDate
  );

  console.info("[email/order-status] Item image URLs", {
    orderId: String(emailOrder._id || ""),
    orderStatus: emailOrder.orderStatus || "",
    assetBaseUrl: getEmailAssetBaseUrl(),
    items: (emailOrder.items || []).map((item, index) => ({
      index: index + 1,
      name: getItemName(item, index),
      rawPreviewImage: item.previewImage || "",
      resolvedPreviewImage: resolveEmailImageUrl(item.previewImage),
      templatePreviewImage: templateParams[`preview_image_${index + 1}`] || "",
    })),
  });

  const htmlContent = `
  <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:8px;overflow:hidden;">
      <div style="background:#111827;color:#ffffff;padding:20px;text-align:center;">
        <h2 style="margin:0;">Maitrova</h2>
      </div>

      <div style="padding:20px;">
        <h3>Hello ${emailUser.name || "Customer"},</h3>
        <p>Your order <strong>#${emailOrder._id}</strong> is now <strong>${emailOrder.orderStatus}</strong>.</p>
        <p><strong>Order Date:</strong> ${orderDate}</p>

        <table width="100%" style="border-collapse:collapse;margin-top:20px;">
          ${itemsHtml}
        </table>

        <div style="margin-top:20px;text-align:right;">
          <p>Subtotal: Rs.${formatAmount(emailOrder.subtotal)}</p>
          <h3>Total: Rs.${formatAmount(emailOrder.total)}</h3>
        </div>

        ${
          emailOrder.orderStatus === "SHIPPED"
            ? `<p style="margin-top:20px;">Your order is on the way! You will receive it soon.</p>`
            : ""
        }

        ${
          emailOrder.orderStatus === "DELIVERED"
            ? `<p style="margin-top:20px;">We hope you love your purchase. Please leave a review.</p>`
            : ""
        }

        <p style="margin-top:30px;">If you have any questions, contact our support team.</p>
      </div>

      <div style="background:#f3f4f6;padding:15px;text-align:center;font-size:12px;color:#555;">
        Copyright ${new Date().getFullYear()} Maitrova. All rights reserved.
      </div>
    </div>
  </div>
  `;

  try {
    await sendBrevoEmail({
      to: [
        {
          email: emailUser.email,
          name: emailUser.name,
        },
      ],
      subject,
      htmlContent,
      templateId,
      params: templateParams,
    });

    console.log("Order email sent successfully");
  } catch (error) {
    console.error("Brevo Error:", error.response?.body || error);
  }
};

export const sendAdminOrderNotification = async (order, user) => {
  const recipients = getAdminRecipients();
  if (!recipients.length) {
    console.warn("Admin order notification skipped: no recipient configured");
    return;
  }

  const hydrated = await hydrateOrderForEmail(order, user);
  const emailOrder = hydrated.order || order;
  const emailUser = hydrated.user || user || {};
  const templateId = getBrevoTemplateId(
    "BREVO_ADMIN_ORDER_TEMPLATE_ID",
    "BREVO_ORDER_ADMIN_TEMPLATE_ID"
  );
  const subject = `New Order Received #${emailOrder._id}`;
  const params = buildAdminOrderTemplateParams(emailOrder, emailUser);

  console.info("[email/admin-order] Item image URLs", {
    orderId: String(emailOrder._id || ""),
    assetBaseUrl: getEmailAssetBaseUrl(),
    items: (emailOrder.items || []).map((item, index) => ({
      index: index + 1,
      name: getItemName(item, index),
      rawPreviewImage: item.previewImage || "",
      resolvedPreviewImage: resolveEmailImageUrl(item.previewImage),
    })),
  });

  const htmlContent = `
  <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
    <div style="max-width:640px;margin:auto;background:#ffffff;border-radius:8px;overflow:hidden;">
      <div style="background:#111827;color:#ffffff;padding:20px;">
        <h2 style="margin:0;">New Order Received</h2>
      </div>
      <div style="padding:20px;color:#111827;">
        <p>Order <strong>#${params.order_id}</strong> was placed on ${params.order_datetime}.</p>
        <p><strong>Customer:</strong> ${params.customer_name} (${params.customer_email})</p>
        <p><strong>Phone:</strong> ${params.customer_phone || "-"}</p>
        <p><strong>Status:</strong> ${params.order_status}</p>
        <p><strong>Payment:</strong> ${params.payment_method} / ${params.payment_status}</p>
        <p><strong>Transaction ID:</strong> ${params.transaction_id}</p>
        <p><strong>Shipping Address:</strong> ${params.shipping_address || "-"}</p>
        <p><strong>Billing Address:</strong> ${params.billing_address || "-"}</p>
        <pre style="white-space:pre-wrap;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">${params.products_text || "No items"}</pre>
        <p><strong>Subtotal:</strong> ${params.subtotal}</p>
        <p><strong>Shipping:</strong> ${params.shipping}</p>
        <p><strong>Tax:</strong> ${params.tax}</p>
        <p><strong>Discount:</strong> ${params.discount}</p>
        <p><strong>Total Paid:</strong> ${params.total}</p>
      </div>
    </div>
  </div>
  `;

  try {
    await sendBrevoEmail({
      to: recipients,
      subject,
      htmlContent,
      templateId,
      params,
    });

    console.log("Admin order notification sent successfully");
  } catch (error) {
    console.error("Admin Brevo Error:", error.response?.body || error);
  }
};
