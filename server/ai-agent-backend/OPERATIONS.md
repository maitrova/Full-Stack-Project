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
# Must be the SAME backend used by the deployed storefront, not local Node:
ECOMMERCE_API_URL=https://maitrova.in/api
```
Configure `ECOMMERCE_STOREFRONT_URL=https://www.maitrova.in` on the Node backend
as well. Deploy the Node backend before restarting/updating the agent: the agent
now calls `POST /api/whatsapp-commerce/link/request` using the shared commerce
key. Node creates and hashes the token in its own database, and returns the secure
URL; the agent no longer inserts checkout tokens into its local MongoDB. A local
API plus a deployed storefront is rejected instead of sending a broken link.
For fully local HTTPS staging/tunnel setups, point both services and the browser
to the matching staging backend; do not mix production checkout with local data.

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
Fresh-link requests keep the confirmed cart operation ID, and previously issued
links remain valid until their own 15-minute expiry. Reissuing a link must not
invalidate an in-progress login or add the same confirmed purchase twice.
Payment questions route to authenticated Razorpay/COD checkout and explicitly tell
customers never to send an OTP, UPI PIN, or card details in WhatsApp. Expired-link
retries revalidate stock and price and create a fresh token for the same cart operation.

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

AI quality monitoring should also track intent confidence, clarification requests,
empty exact searches, duplicate-result rate, rejected result validations, model
provider failures, and human handoff rate. Keep a regression set of real customer
phrases under `tests/` and run it before changing intent rules, catalogue taxonomy,
or response prompts.

Run the local evaluation set with:

`python scripts/evaluate_intents.py`

Backfill derived search metadata for existing products with:

`python scripts/backfill_catalogue.py --passes 100`

Both commands leave the ecommerce product documents unchanged. The AI metrics
endpoint now exposes clarification, empty-search, and handoff rates for dashboard
and alert integrations.

Each AI request now carries a privacy-safe `request_id` through message metadata,
tool audits, metrics, and logs. Use that ID to reconstruct a failed interaction
without logging customer message text in operational metrics.

For production Helm releases, set `existingSecret` to a Secret managed by the
cluster or an external-secrets controller. Rotate any credentials that were ever
committed to values files; changing the chart does not revoke previously exposed
credentials. The pod security context defaults to non-root, RuntimeDefault
seccomp, no privilege escalation, read-only root filesystem, and dropped Linux
capabilities.

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

# Website chat agent: testing and monitoring

The website chat uses the tool-calling agent (`app/ai/web_agent.py`) when
`WEB_AGENT_MODE=tools`, or for `WEB_AGENT_ROLLOUT_PERCENT` of browser sessions.
It falls back to the rules agent for images, model errors, timeouts and replies
that fail the grounding check, and sends a short "busy" reply when the AI
provider rate-limits or a reply takes longer than the time limit.

Gemini free-tier quotas are per model (500 requests/day each). When the main
model (`GEMINI_MODEL`) is rate-limited or its daily quota is spent, the agent
moves to `GEMINI_FALLBACK_MODELS` (default `gemini-3.5-flash-lite`) and skips
the exhausted model for an hour. Each chat message uses 2-3 requests, so for
real traffic enable billing on the Google project rather than relying on this.

## Regression test set

`tests/fixtures/web_agent_scenarios.json` holds 87 end-to-end scenarios
(products, drops, customization, design library, policies, signed-in and guest
orders, cart, offers, handoff, off-topic and safety). The runner plays the
shopper's browser: it sends the real cart, carries out returned cart actions on
the store API, and checks replies, tools, cards, orders, cart contents and
handoff alerts.

Local prerequisites: the store API and this service running with
`WEB_AGENT_MODE=tools`; `node server/scripts/seedAiTestProducts.js` and
`node server/scripts/seedAiTestOrders.js`; policy pages in `companydocuments`.

    python scripts/web_agent_regression.py --save            # all scenarios
    python scripts/web_agent_regression.py --groups cart,policy
    python scripts/web_agent_regression.py --ids K04,G02 --delay 1

The run refuses a non-local store API (it changes carts and creates alerts)
unless `--allow-remote`, closes the alerts it created, writes a JSON report to
`outputs/`, and exits 1 below `--min-pass` (default 90%). `--save` stores the run
in `ai_agent_evaluations`, so it appears on the admin AI evaluation page.
Run it before every deploy that touches the agent, its prompt, the catalogue
schema, or the Gemini model; a full run makes about 250 model calls.

## Monitoring

`GET /api/ai/metrics` (merchant login) has a `web_agent` section for the last
24 hours: replies, busy replies, fallbacks and their reasons, grounding retries,
corrected cart claims, cart actions, tool usage, handoffs, average and p90
latency, and cost per conversation. Its alerts are merged into `alerts`:

| Alert | Fires at | Usual cause |
|---|---|---|
| `ai_provider_rate_limited` (critical) | 5% of replies busy | Gemini quota or billing |
| `ai_provider_slow` | 5% of messages timed out | provider latency; the shopper was asked to resend (limit: `WEB_AGENT_TOTAL_TIMEOUT_SECONDS`, default 40) |
| `high_fallback_rate` | 15% of replies | provider errors/timeouts, or grounding failures (see `fallback_reasons`) |
| `high_grounding_retry_rate` | 20% of replies | the model inventing prices/links; check prompt or catalogue data |
| `cart_claims_corrected` | 5% of replies | the model claiming cart changes without tools |
| `slow_replies` | p90 above 12 s | provider latency or too many tool rounds |

Thresholds live in `app/services/web_agent_monitor.py`.

## Weekly review

`GET /api/ai/review-sample?limit=20&days=7` (merchant login) returns a random
sample of recent website conversations, most-flagged first. Each AI reply lists
its tools, cart actions and flags (`rules_agent`, `grounding_retry`, `busy`,
`cart_claim_corrected`). Read them weekly; for every wrong or weak answer, add a
scenario to `web_agent_scenarios.json` before fixing it, so it stays fixed.

## WhatsApp: talking to a person and order updates

**Talk to a person.** Replies about orders, complaints, refunds or returns, and replies after a failed lookup, carry a
"Talk to a person" button. Tapping it (or typing "talk to a person") creates an alert on the WhatsApp chats dashboard
without asking for contact details, because the team replies on the same number. This step runs in code, so it works
even when the AI model is unavailable.

**Who answers when:**

| Situation | What happens |
|---|---|
| Alert open, nobody has picked it up | The AI keeps answering, and the alert stays on the dashboard. |
| A teammate replies from the dashboard, presses Pause AI, or presses Assign to me | The AI pauses. The customer gets one "our team has your message" note, and later messages wait for the team. |
| The team presses Resume AI | The AI answers again. |
| No team reply for `WHATSAPP_HANDOFF_IDLE_HOURS` (12) | The AI resumes by itself; the alert is marked `auto_resumed`. |

**Dashboard replies** go Express `POST /api/admin/whatsapp-chats/:id/reply` → AI service
`/api/whatsapp/internal/team-reply` → WhatsApp. Meta allows free text only within 24 hours of the customer's last
message; outside that window the reply box is disabled and the API returns 409.

**Order updates.** Express order and payment code calls the AI service (`/api/whatsapp/internal/order-update`) for
customers who linked WhatsApp and haven't sent STOP. Inside the 24-hour window a plain text is sent; outside it the
`WHATSAPP_ORDER_UPDATE_TEMPLATE` template is used, or nothing is sent if none is set. Each order event is sent at most
once. Every attempt is recorded in `whatsapp_notification_log` (`status`: sent / failed / skipped, plus `reason`).

Template to create in Meta Business Manager (category **Utility**, language English, name `order_update`):

> Hi, your Maitrova order #{{1}} is now {{2}}. Total: {{3}}. Reply to this message if you need help, or send STOP to turn off order updates.

Sample values for review: `44FE2A88`, `shipped`, `INR 1399.00`.

**Configuration.** Both servers need the same `WHATSAPP_COMMERCE_KEY`. Express needs `AI_SERVICE_URL`
(default `http://127.0.0.1:8000/api`; in Kubernetes `http://ai-agent:8000/api`). Only the AI service holds the Meta
credentials.

**Local testing.** Start the simulator AI instance (see `scripts/whatsapp_simulator.py`) and a second Express on another
port with `AI_SERVICE_URL=http://127.0.0.1:8011/api`, so dashboard replies and order updates reach the fake Meta server
instead of real customers.

## WhatsApp: regression, monitoring and rollout

### Regression set

`tests/fixtures/whatsapp_scenarios.json` has 59 scenarios in 9 groups: products, drops and customization, policy,
cart (connected account), cart (not connected), orders, handoff, order updates, and safety. Each one plays a WhatsApp
customer through the simulator and checks the texts, photos, buttons, tools, the real store cart, handoff alerts and
order updates.

```
# 1. AI instance whose WhatsApp messages go to the fake Meta server (port 8020)
MONGODB_DB_NAME=appdb_wa_test WHATSAPP_GRAPH_API_BASE_URL=http://127.0.0.1:8020 WHATSAPP_AGENT_MODE=tools WHATSAPP_ORDER_UPDATE_TEMPLATE=order_update uvicorn app.main:app --port 8011
# 2. Store API on 5000 (same WHATSAPP_COMMERCE_KEY), test data seeded as for the website set
# 3. Run
python scripts/whatsapp_regression.py                  # everything (about 20 minutes)
python scripts/whatsapp_regression.py --groups cart,handoff --save
```

Test customers use numbers starting 999 (no such country code), so nothing can reach a real person. The run creates a
temporary shopper and removes it afterwards, along with the account links, carts and subscriptions it created, and it
closes the alerts it opened. It exits 1 below a 90% pass rate (`--min-pass`). With `--save`, the report appears with the
website runs on the AI evaluation page. A run uses about 150 Gemini calls.

### Monitoring

`GET /api/ai/metrics` now reports each channel separately:

- `web_agent`: the website (rows from before channels were recorded count as website).
- `whatsapp_agent`: the same health figures for WhatsApp (busy, timeouts, fallbacks, grounding retries, latency, cost).
  Its alerts are prefixed `whatsapp_`.
- `whatsapp_health`: what only WhatsApp has.

| Alert | Meaning | What to do |
|---|---|---|
| `whatsapp_queue_stuck` (critical) | Messages have waited over 5 minutes | Check the AI service is running; restart it |
| `whatsapp_jobs_failed` | Messages failed 5 times and got no reply | Read the AI service logs for that hour |
| `whatsapp_template_rejected` (critical) | Meta refused the order-update template | Check the template's name, language and approval in Meta Business Manager |
| `whatsapp_delivery_failures` | Meta couldn't deliver 5 or more messages | See `delivery_failure_codes`; 131047 means the 24-hour window had closed, 131026 means the number can't receive messages |
| `whatsapp_updates_need_template` | Order updates were skipped outside the 24-hour window | Get the `order_update` template approved and set `WHATSAPP_ORDER_UPDATE_TEMPLATE` |
| `whatsapp_updates_failed` | Order updates failed | See `order_updates.failure_reasons` |
| `whatsapp_handoff_waiting` | A customer has waited over 2 hours for the team | Answer from WhatsApp chats → Team requested |

Meta's delivery-status callbacks are recorded in `whatsapp_delivery_failures` (error code and title only, kept 30
days). The WhatsApp chats page shows "Not delivered by Meta" and "Order updates not sent" for the last 24 hours.

### Rollout

The tool-calling agent is chosen per customer number. Every stage can be undone by changing one setting and
restarting the AI service:

| Stage | Settings | Move on when |
|---|---|---|
| 0. Staging | Regression set passes at 90% or more against the staging stack | All groups pass; any failures have been read and understood |
| 1. Team and Meta test numbers | `WHATSAPP_AGENT_ALLOWLIST=<team phones, Meta test number>` | About a week of real use by the team with no critical alerts; the order-update template is approved |
| 2. 20% of customers | `WHATSAPP_AGENT_ROLLOUT_PERCENT=20` (keep the allowlist) | One week: `whatsapp_agent` fallback rate under 15%, busy rate under 5%, p90 latency under 12 s, no critical `whatsapp_health` alerts, and the weekly review sample looks right |
| 3. Everyone | `WHATSAPP_AGENT_MODE=tools` | Keep watching the same thresholds |

**Rollback:** `WHATSAPP_AGENT_MODE=rules`, `WHATSAPP_AGENT_ROLLOUT_PERCENT=0`, and an empty allowlist. Customers go back
to the rules agent on their next message, and nothing else changes (carts, links and handoffs are shared).

**Before stage 2:** move Gemini to a paid tier. WhatsApp and the website share the same quota, and the free tier
allows 500 requests a day per model.

