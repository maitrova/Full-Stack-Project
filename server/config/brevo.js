import Brevo from "@getbrevo/brevo";

const apiInstance = new Brevo.TransactionalEmailsApi();
const brevoApiKey =
  process.env.BREVO_API_KEY || process.env.BREVO_RESET_PASSWORD_KEY;

if (brevoApiKey) {
  apiInstance.setApiKey(
    Brevo.TransactionalEmailsApiApiKeys.apiKey,
    brevoApiKey
  );
}

export default apiInstance;
