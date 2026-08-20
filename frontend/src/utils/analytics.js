const DEFAULT_CURRENCY = "INR";

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getProductSource = (item = {}) =>
  item.dropproduct ||
  item.readymadeProduct ||
  item.design ||
  item.product ||
  item.comboPack ||
  item;

const getProductId = (item = {}, source = getProductSource(item)) =>
  source?._id ||
  source?.id ||
  item.dropproductId ||
  item.readymadeProductId ||
  item.designId ||
  item.productId ||
  item.comboPackId ||
  item._id ||
  item.id ||
  "";

const getProductName = (item = {}, source = getProductSource(item)) =>
  source?.title ||
  source?.name ||
  source?.productName ||
  source?.designName ||
  source?.comboName ||
  item.title ||
  item.name ||
  item.productName ||
  item.comboName ||
  item.comboPackName ||
  (item.kind === "DESIGN" ? "Customized Product" : "Product");

export const buildAnalyticsItem = (item = {}, overrides = {}) => {
  const source = getProductSource(item);
  const quantity = toNumber(overrides.quantity ?? item.qty ?? item.quantity, 1);
  const price = toNumber(
    overrides.price ??
      overrides.item_price ??
      item.unitPrice ??
      source?.effectivePrice ??
      source?.price ??
      source?.basePrice,
    0
  );

  return {
    item_id: String(overrides.item_id ?? overrides.id ?? getProductId(item, source)),
    item_name: String(overrides.item_name ?? overrides.name ?? getProductName(item, source)),
    item_category: overrides.item_category ?? source?.category ?? item.category ?? "",
    item_variant: overrides.item_variant ?? item.size ?? item.selectedSize ?? source?.size ?? "",
    price,
    quantity,
    currency: overrides.currency ?? item.currency ?? source?.currency ?? DEFAULT_CURRENCY,
  };
};

export const buildAnalyticsItems = (items = []) =>
  items.map((item) => buildAnalyticsItem(item));

export const pushAnalyticsEvent = (event, ecommerce = {}, extra = {}) => {
  if (typeof window === "undefined") return;

  const eventPayload = {
    ...ecommerce,
    ...extra,
  };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event,
    ecommerce,
    ...extra,
  });

  if (typeof window.gtag === "function") {
    window.gtag("event", event, eventPayload);
  }
};

export const trackViewItem = ({ item, value, currency = DEFAULT_CURRENCY } = {}) => {
  const analyticsItem = buildAnalyticsItem(item, { currency });
  pushAnalyticsEvent("view_item", {
    currency: analyticsItem.currency || currency,
    value: toNumber(value ?? analyticsItem.price, 0),
    items: [analyticsItem],
  });
};

export const trackAddToCart = ({
  item,
  items,
  value,
  currency = DEFAULT_CURRENCY,
} = {}) => {
  const sourceItems = Array.isArray(items) && items.length ? items : [item];
  const analyticsItems = buildAnalyticsItems(sourceItems).map((analyticsItem) => ({
    ...analyticsItem,
    currency: analyticsItem.currency || currency,
  }));

  pushAnalyticsEvent("add_to_cart", {
    currency,
    value: toNumber(
      value,
      analyticsItems.reduce((sum, analyticsItem) => (
        sum + analyticsItem.price * analyticsItem.quantity
      ), 0)
    ),
    items: analyticsItems,
  });
};

export const trackBeginCheckout = ({
  items = [],
  value,
  currency = DEFAULT_CURRENCY,
  coupon = "",
} = {}) => {
  const analyticsItems = buildAnalyticsItems(items);
  pushAnalyticsEvent("begin_checkout", {
    currency,
    value: toNumber(
      value,
      analyticsItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    ),
    coupon,
    items: analyticsItems,
  });
};

const buildCheckoutEventKey = ({ items = [], value, coupon = "" } = {}) => {
  const itemKey = buildAnalyticsItems(items)
    .map((item) => `${item.item_id}:${item.item_variant}:${item.quantity}`)
    .join("|");

  return `ga4_begin_checkout:${itemKey}:${toNumber(value, 0)}:${coupon}`;
};

export const trackBeginCheckoutOnce = (checkout = {}) => {
  const key = buildCheckoutEventKey(checkout);

  if (typeof window !== "undefined" && window.sessionStorage) {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  }

  trackBeginCheckout(checkout);
};

export const trackAddPaymentInfo = ({
  items = [],
  value,
  currency = DEFAULT_CURRENCY,
  coupon = "",
  paymentType = "",
} = {}) => {
  const analyticsItems = buildAnalyticsItems(items);
  pushAnalyticsEvent("add_payment_info", {
    currency,
    value: toNumber(
      value,
      analyticsItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    ),
    coupon,
    payment_type: paymentType,
    items: analyticsItems,
  });
};

export const trackPurchase = ({
  transactionId,
  items = [],
  value,
  currency = DEFAULT_CURRENCY,
  coupon = "",
  shipping = 0,
  tax = 0,
  paymentType = "",
} = {}) => {
  const analyticsItems = buildAnalyticsItems(items);
  pushAnalyticsEvent("purchase", {
    transaction_id: String(transactionId || ""),
    currency,
    value: toNumber(value, 0),
    coupon,
    shipping: toNumber(shipping, 0),
    tax: toNumber(tax, 0),
    payment_type: paymentType,
    items: analyticsItems,
  });
};

export const trackSearch = ({ searchTerm, source = "site_search", resultsCount } = {}) => {
  const normalizedTerm = String(searchTerm || "").trim();
  if (!normalizedTerm) return;

  pushAnalyticsEvent(
    "search",
    {},
    {
      search_term: normalizedTerm,
      search_source: source,
      ...(resultsCount !== undefined ? { search_results_count: toNumber(resultsCount, 0) } : {}),
    }
  );
};
