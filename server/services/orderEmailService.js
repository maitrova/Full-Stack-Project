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
  { path: "user", select: "name email" },
  { path: "items.readymadeProduct", select: "title" },
  { path: "items.design", select: "title productName" },
  { path: "items.dropproduct", select: "name" },
  { path: "items.product", select: "name" },
];

const formatAmount = (value) => Number(value || 0).toFixed(2);

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
    .map(
      (item, index) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          <img src="${item.previewImage || ""}" width="60" />
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
    `
    )
    .join("");

const buildOrderTemplateParams = (order, user, itemsHtml, orderDate) => {
  const normalizedItems = (order.items || []).map((item, index) => ({
    index: index + 1,
    name: getItemName(item, index),
    previewImage: item.previewImage || "",
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
      params: buildOrderTemplateParams(emailOrder, emailUser, itemsHtml, orderDate),
    });

    console.log("Order email sent successfully");
  } catch (error) {
    console.error("Brevo Error:", error.response?.body || error);
  }
};
