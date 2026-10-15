// WhatsApp messages are sent by the AI service, which holds the Meta
// credentials, applies the 24-hour rule (text inside the window, approved
// template outside it), sends each order event once, and logs failures.
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");

export const callWhatsAppService = async (path, body) => {
  const key = process.env.WHATSAPP_COMMERCE_KEY;
  if (!key || typeof fetch !== "function") return { status: 503, data: { message: "WhatsApp service is not configured" } };
  const response = await fetch(`${AI_SERVICE_URL}/whatsapp/internal/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-commerce-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { status: response.status, data };
};

const orderTotal = (order) => `${order?.currency || "INR"} ${Number(order?.total || 0).toFixed(2)}`;

export const sendWhatsAppOrderUpdate = async (order, eventName) => {
  const userId = order?.user?._id || order?.user;
  if (!userId || !order?._id) return { sent: false, reason: "no_user" };
  const { status, data } = await callWhatsAppService("order-update", {
    user_id: String(userId),
    order_id: String(order._id),
    event: String(eventName || "ORDER_CONFIRMED").trim().toUpperCase(),
    total: orderTotal(order),
  });
  if (status >= 400) return { sent: false, reason: data?.message || `http_${status}` };
  return data;
};

export const sendWhatsAppOrderUpdateSafely = async (order, eventName) => {
  try {
    return await sendWhatsAppOrderUpdate(order, eventName);
  } catch (error) {
    console.error("[whatsapp-order-update]", eventName, String(order?._id || ""), error.message);
    return { sent: false, reason: "delivery_failed" };
  }
};
