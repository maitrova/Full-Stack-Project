# WhatsApp integration deployment

Deploy Node and this FastAPI service separately. The frontend must include the
`/whatsapp-connect` page. Customer sign-in stays on the existing store website.

Required agent environment:
- `WHATSAPP_APP_SECRET`: Meta application secret, NOT the verification token.
- `WHATSAPP_COMMERCE_KEY`: same random secret as the Node server environment.
- `ECOMMERCE_API_URL`: reachable Node base API URL, ending in `/api`.
- `ECOMMERCE_STOREFRONT_URL`: public HTTPS shopping website origin.
- `ECOMMERCE_PUBLIC_URL`: public base serving the stored product image paths.
- Explicit database URLs/names in deployments (parent .env is local convenience).
- `WHATSAPP_MESSAGES_PER_MINUTE` and `WHATSAPP_CHECKOUT_LINKS_PER_HOUR` tune abuse limits.

Required Node environment:
- `RAZORPAY_WEBHOOK_SECRET`: the dedicated webhook secret configured in Razorpay.
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_GRAPH_VERSION`.
- Approved transactional template names in `WHATSAPP_TEMPLATE_ORDER_CONFIRMED`,
  `WHATSAPP_TEMPLATE_PAYMENT_FAILED`, `WHATSAPP_TEMPLATE_ORDER_READY`,
  `WHATSAPP_TEMPLATE_ORDER_SHIPPED`, `WHATSAPP_TEMPLATE_ORDER_DELIVERED`,
  `WHATSAPP_TEMPLATE_ORDER_CANCELLED`, `WHATSAPP_TEMPLATE_REFUND_PROCESSING`,
  `WHATSAPP_TEMPLATE_REFUND_PAID`, and `WHATSAPP_TEMPLATE_REFUND_FAILED`.
  Each template must accept order ID, event text, and total as its three body values.

Template variables may be left empty initially. The integration then uses its
built-in English order messages while the customer-service window is open. Every
inbound customer message refreshes that 24-hour window. Meta does not allow
free-form business messages outside it, so updates outside the window are skipped
until at least one approved template is configured.

Existing WhatsApp credentials and Gemini settings remain required. Do not expose
server secrets through Vite environment variables. Restart both application servers.

Maitrova URL configuration (agent environment):
```dotenv
ECOMMERCE_STOREFRONT_URL=https://www.maitrova.in
ECOMMERCE_PUBLIC_URL=https://maitrova.in/api/outputs
# For local Node on port 5000; change for separate production containers/hosts:
ECOMMERCE_API_URL=http://127.0.0.1:5000/api
```
The image URL is NOT the commerce API URL. Generate a random commerce key locally
(`python -c "import secrets; print(secrets.token_hex(32))"`) and save the same value
as `WHATSAPP_COMMERCE_KEY` in Node's `.env` and the agent's `.env`. Do not share it
in chat. Obtain the separate Meta app secret from your Meta app configuration and
save it locally as `WHATSAPP_APP_SECRET`. Rotate any exposed access credentials.

Offline verification from the agent directory:
```text
python -m unittest test_commerce test_webhook_security tests.test_context tests.test_product_actions -q
node --experimental-vm-modules --test ../tests/whatsappCommerce.test.mjs
```
The tests mock databases and outbound calls. They do not place real orders or
prove that the deployed website, image URLs, Meta account or checkout work.

The signed POST webhook enqueues work and immediately acknowledges it. Invalid
signatures fail with 403; missing Meta app secret fails with 503. GET verification
still uses WHATSAPP_VERIFY_TOKEN. Jobs and per-image progress survive restarts.
Monitor `whatsapp_jobs` for `status: failed`, and the application error logs.
Retries are limited to five. A timeout after Meta accepts a send can still cause
a duplicate delivery; this integration does not claim exactly-once delivery.

Account linking is one tap: after confirmation the agent sends a 15-minute
`/whatsapp-connect?token=...` link. The page asks the customer to sign in only when
needed, consumes the token once, adds the previously confirmed item idempotently,
and redirects directly to checkout. The customer never copies or sends a code.
Linked access lasts 24 hours. Website revoke, WhatsApp `disconnect`, or `STOP`
revokes access; STOP also disables transactional WhatsApp updates. Order lookup is
scoped to the linked user and supports a specific 24-character order ID, latest,
or second-most-recent order.

Purchase: select product, ask to add to cart, choose size and quantity, confirm.
Quantity replies may be bare digits or natural English, Hindi, or Telugu phrases.
Node rechecks live price/stock and uses the existing cart controller. Repeated
operation IDs do not increment quantities twice; ambiguous failed operations are
held for inspection, not blindly replayed. Payment, shipping address and final
order creation take place on the existing authenticated checkout website.
Cancellation/return requests link to the account's order page for submission.
Payment questions route to authenticated Razorpay/COD checkout and explicitly tell
customers never to send an OTP, UPI PIN, or card details in WhatsApp. Expired-link
retries revalidate stock and price and create a fresh idempotent cart operation.

Razorpay must POST to `/api/payment/webhooks/razorpay`. The raw-body route verifies
the signature before JSON parsing. `payment.captured` and `order.paid` recover a
paid order and finish inventory, coupon, cart, email, and WhatsApp processing;
`payment.failed` records the failure. Refund webhooks update refund state and send
the corresponding transactional update.

Operations endpoints on the agent API:
- `GET /api/conversations/handoffs` lists open conversations awaiting staff.
- `GET /api/conversations/operations` reports job and handoff counts.
- `POST /api/conversations/operations/retry-failed` requeues eligible failed jobs.
Changing a conversation to OPEN resumes the agent; a human reply assigns the alert.
Monitor failed job counts, open handoff age, Razorpay webhook errors, and WhatsApp
delivery errors. Notification audit entries expire after 180 days.

Store policy answers use published HTML in `companydocuments`. PDF-only documents
and missing policies are handed to staff rather than guessed. `human` flags the
conversation as handoff and pauses subsequent automated replies.

Scope: readymade items can be confirmed and handed to checkout directly. Custom
designs and combos require their visual/configuration selections, so the agent
routes customers to `/customproducts` or `/combo-packs`; drop products remain
supported by the existing website/cart path. No phone-number identity guessing is
used: the signed website session is the identity authority.

Before enabling customer traffic, test on a test Meta number and staging store:
signature rejection; linking/revocation/expiry; cross-account orders; product
changes; size-stock and expired offers; confirmed cart versus duplicate retry;
checkout; handoff; worker restart; image delivery; payment failure and recovery.
Do not call this deployment production-approved until these acceptance checks pass.
