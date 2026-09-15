import mongoose from "mongoose";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v22.0";
const TEMPLATE_BY_EVENT = {
  ORDER_CONFIRMED: "WHATSAPP_TEMPLATE_ORDER_CONFIRMED",
  PAYMENT_FAILED: "WHATSAPP_TEMPLATE_PAYMENT_FAILED",
  READY: "WHATSAPP_TEMPLATE_ORDER_READY",
  SHIPPED: "WHATSAPP_TEMPLATE_ORDER_SHIPPED",
  DELIVERED: "WHATSAPP_TEMPLATE_ORDER_DELIVERED",
  CANCELLED: "WHATSAPP_TEMPLATE_ORDER_CANCELLED",
  REFUND_PROCESSING: "WHATSAPP_TEMPLATE_REFUND_PROCESSING",
  REFUND_PAID: "WHATSAPP_TEMPLATE_REFUND_PAID",
  REFUND_FAILED: "WHATSAPP_TEMPLATE_REFUND_FAILED",
};

const normalizeEvent = (value) => String(value || "ORDER_CONFIRMED").trim().toUpperCase();
const orderId = (order) => String(order?._id || "");
const orderTotal = (order) => `${order?.currency || "INR"} ${Number(order?.total || 0).toFixed(2)}`;

const buildText = (order, event) => {
  const id = orderId(order);
  const messages = {
    ORDER_CONFIRMED: `Your Maitrova order #${id} is confirmed. Total: ${orderTotal(order)}.`,
    PAYMENT_FAILED: `Payment for Maitrova order #${id} was not completed. Open your cart to try again.`,
    READY: `Your Maitrova order #${id} is ready.`,
    SHIPPED: `Your Maitrova order #${id} has shipped. Open your account to track it.`,
    DELIVERED: `Your Maitrova order #${id} has been delivered.`,
    CANCELLED: `Your Maitrova order #${id} has been cancelled.`,
    REFUND_PROCESSING: `The refund for Maitrova order #${id} is being processed.`,
    REFUND_PAID: `The refund for Maitrova order #${id} has been completed.`,
    REFUND_FAILED: `The refund for Maitrova order #${id} needs attention. Please contact support.`,
  };
  return messages[event] || `Maitrova order #${id} status: ${event}.`;
};

const postWhatsApp = async (recipient, payload) => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId || typeof fetch !== "function") {
    return { sent: false, reason: "not_configured" };
  }

  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: recipient, ...payload }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhatsApp order update failed (${response.status}): ${body.slice(0, 300)}`);
  }
  return { sent: true };
};

export const sendWhatsAppOrderUpdate = async (order, eventName) => {
  const userId = order?.user?._id || order?.user;
  if (!userId || mongoose.connection.readyState !== 1) {
    return { sent: false, reason: "no_user_or_database" };
  }

  const subscription = await mongoose.connection.db.collection("whatsapp_order_subscriptions").findOne({
    user: userId,
    active: true,
  });
  if (!subscription?.recipient) return { sent: false, reason: "not_subscribed" };

  const event = normalizeEvent(eventName);
  const templateName = process.env[TEMPLATE_BY_EVENT[event]] || process.env.WHATSAPP_TEMPLATE_ORDER_UPDATE;
  let result;
  if (templateName) {
    result = await postWhatsApp(subscription.recipient, {
      type: "template",
      template: {
        name: templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en" },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: orderId(order) },
            { type: "text", text: event.replaceAll("_", " ") },
            { type: "text", text: orderTotal(order) },
          ],
        }],
      },
    });
  } else if (
    subscription.customer_window_expires_at &&
    new Date(subscription.customer_window_expires_at).getTime() > Date.now()
  ) {
    result = await postWhatsApp(subscription.recipient, { type: "text", text: { body: buildText(order, event) } });
  } else {
    return { sent: false, reason: "template_required" };
  }

  if (result.sent) {
    await mongoose.connection.db.collection("whatsapp_notification_log").insertOne({
      user: userId,
      order: order?._id,
      event,
      recipient: subscription.recipient,
      sentAt: new Date(),
    });
  }
  return result;
};

export const sendWhatsAppOrderUpdateSafely = async (order, eventName) => {
  try {
    return await sendWhatsAppOrderUpdate(order, eventName);
  } catch (error) {
    console.error("[whatsapp-order-update]", eventName, orderId(order), error.message);
    return { sent: false, reason: "delivery_failed" };
  }
};
