import apiInstance from "../config/brevo.js";

const defaultSender = {
  name: process.env.BREVO_SENDER_NAME || "Maitrova",
  email: process.env.BREVO_SENDER_EMAIL || "maitrova122@gmail.com",
};

const parseTemplateId = (value) => {
  if (!value) return null;

  const templateId = Number(value);
  return Number.isInteger(templateId) && templateId > 0 ? templateId : null;
};

export const getBrevoTemplateId = (...envKeys) => {
  for (const envKey of envKeys) {
    const templateId = parseTemplateId(process.env[envKey]);
    if (templateId) {
      return templateId;
    }
  }

  return null;
};

export const sendBrevoEmail = async ({
  to,
  subject,
  htmlContent,
  templateId,
  params,
  sender = defaultSender,
}) => {
  const payload = {
    sender,
    to,
  };

  if (templateId) {
    payload.templateId = templateId;
    if (params && Object.keys(params).length > 0) {
      payload.params = params;
    }
  } else {
    payload.subject = subject;
    payload.htmlContent = htmlContent;
  }

  return apiInstance.sendTransacEmail(payload);
};
