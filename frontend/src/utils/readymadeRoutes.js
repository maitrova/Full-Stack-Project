const slugifyPathSegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getReadymadeSource = (value) => {
  if (!value || typeof value !== "object") return value || null;
  if (value.readymadeProduct && typeof value.readymadeProduct === "object") return value.readymadeProduct;
  if (value.product && typeof value.product === "object") return value.product;
  if (value.raw && typeof value.raw === "object") return { ...value.raw, ...value };
  return value;
};

export const buildReadymadeProductPath = (value) => {
  const product = getReadymadeSource(value);
  if (!product) return null;

  const id = product._id || value?._id || null;
  const category = slugifyPathSegment(product.category);
  const subCategory = slugifyPathSegment(product.subCategory);
  const title = slugifyPathSegment(product.title || product.name || product.productName);

  if (category && subCategory && title) {
    return `/${category}/${subCategory}/${title}`;
  }

  return id ? `/readymade/${id}` : null;
};

export const slugifyReadymadeSegment = slugifyPathSegment;
