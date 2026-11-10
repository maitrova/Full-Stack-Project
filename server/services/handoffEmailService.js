import mongoose from "mongoose";
import User from "../models/authmodel.js";
import { getBrevoTemplateId, sendBrevoEmail } from "./brevoEmailService.js";

const clean = (value, maxLength = 200) =>
  String(value ?? "").trim().slice(0, maxLength) || "-";

const CHANNEL_NAMES = { whatsapp: "WhatsApp", web: "website" };

// These names are the variables Brevo template 31 uses, e.g. {{ params.CUSTOMER_NAME }}.
export const buildHandoffEmailParams = (handoff = {}, account = {}) => {
  const channel = String(handoff.channel || "").trim().toLowerCase();
  return {
    CHANNEL: CHANNEL_NAMES[channel] || clean(handoff.channel, 40),
    CUSTOMER_NAME: clean(handoff.customer_name || account.name, 120),
    CUSTOMER_PHONE: clean(handoff.phone || account.phone, 40),
    CUSTOMER_EMAIL: clean(handoff.email || account.email, 120),
    ORDER_ID: handoff.order_id ? `#${clean(handoff.order_id, 24).replace(/^#/, "")}` : "-",
    REQUESTED_AT: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    CUSTOMER_MESSAGE: clean(handoff.customer_message, 1000),
    CONVERSATION_SUMMARY: clean(handoff.summary, 500),
  };
};

// A signed-in customer's account fills in whatever the chat did not capture.
const findAccount = async (customerId) => {
  if (!customerId || !mongoose.isValidObjectId(customerId)) return {};
  try {
    return (await User.findById(customerId).select("name phone email").lean()) || {};
  } catch {
    return {};
  }
};

export const sendHandoffEmail = async (handoff = {}) => {
  const templateId = getBrevoTemplateId("BREVO_HANDOFF_ADMIN_TEMPLATE_ID");
  const email = (process.env.ADMIN_HANDOFF_EMAIL || "").trim();
  if (!templateId || !email) {
    console.warn("Handoff email skipped: template id or recipient not configured");
    return { sent: false, reason: "not_configured" };
  }

  await sendBrevoEmail({
    to: [{ email, name: process.env.ADMIN_NOTIFICATION_NAME || "Maitrova Admin" }],
    templateId,
    params: buildHandoffEmailParams(handoff, await findAccount(handoff.customer_id)),
  });
  return { sent: true };
};
