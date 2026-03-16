const roundCurrency = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isReadymadeOfferActive = (product, now = new Date()) => {
  const mrp = Number(product?.price || 0);
  const salePrice = Number(product?.salePrice || 0);

  if (!(mrp > 0) || !(salePrice > 0) || !(salePrice < mrp)) {
    return false;
  }

  const saleStartAt = normalizeDate(product?.saleStartAt);
  const saleEndAt = normalizeDate(product?.saleEndAt);

  if (saleStartAt && now < saleStartAt) return false;
  if (saleEndAt && now > saleEndAt) return false;

  return true;
};

export const getReadymadePricing = (product, options = {}) => {
  const now = options.now || new Date();
  const variant = options.variant || null;

  const productMrp = roundCurrency(product?.price || 0);
  const variantMrp = roundCurrency(variant?.price ?? productMrp);
  const saleActive = isReadymadeOfferActive(product, now);

  let effectivePrice = variantMrp;
  let saveAmount = 0;
  let discountPercent = 0;

  if (saleActive && productMrp > 0) {
    const discountRatio = Number(product.salePrice) / productMrp;
    effectivePrice = roundCurrency(variantMrp * discountRatio);
    if (effectivePrice >= variantMrp) {
      effectivePrice = Math.max(0, roundCurrency(variantMrp - 0.01));
    }
    saveAmount = roundCurrency(variantMrp - effectivePrice);
    discountPercent =
      variantMrp > 0 ? Math.round((saveAmount / variantMrp) * 100) : 0;
  }

  return {
    mrp: variantMrp,
    originalPrice: variantMrp,
    effectivePrice,
    finalPrice: effectivePrice,
    saleActive,
    salePrice: saleActive ? effectivePrice : null,
    productSalePrice: saleActive ? roundCurrency(product.salePrice) : null,
    saleStartAt: normalizeDate(product?.saleStartAt),
    saleEndAt: normalizeDate(product?.saleEndAt),
    saveAmount,
    discountPercent,
  };
};

export const attachReadymadePricing = (product, options = {}) => {
  if (!product) return product;

  const nextProduct = product;
  const basePricing = getReadymadePricing(product, options);

  nextProduct.mrp = basePricing.mrp;
  nextProduct.originalPrice = basePricing.originalPrice;
  nextProduct.effectivePrice = basePricing.effectivePrice;
  nextProduct.finalPrice = basePricing.finalPrice;
  nextProduct.offerPrice = basePricing.salePrice;
  nextProduct.saleActive = basePricing.saleActive;
  nextProduct.offerActive = basePricing.saleActive;
  nextProduct.saveAmount = basePricing.saveAmount;
  nextProduct.discountPercent = basePricing.discountPercent;

  if (Array.isArray(nextProduct.variants)) {
    nextProduct.variants = nextProduct.variants.map((variant) => ({
      ...variant,
      ...getReadymadePricing(product, { ...options, variant }),
    }));
  }

  return nextProduct;
};
