const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const formatHomepagePrice = (price, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(price));

export const getHomepageItemPricing = (item) => {
  const currency = item?.currency || "INR";
  const currentPrice = toNumber(item?.price);
  const originalPrice = toNumber(item?.originalPrice ?? item?.mrp);
  const hasOffer =
    item?.type === "readymade" &&
    Boolean(item?.saleActive || item?.offerActive) &&
    originalPrice > currentPrice &&
    currentPrice > 0;

  return {
    currency,
    currentPrice,
    originalPrice: hasOffer ? originalPrice : 0,
    saveAmount: hasOffer ? toNumber(item?.saveAmount) : 0,
    discountPercent: hasOffer ? toNumber(item?.discountPercent) : 0,
    hasOffer,
  };
};
