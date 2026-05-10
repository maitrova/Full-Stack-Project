const slugifySegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildDropProductPath = (value) => {
  const product = value?.dropproduct && typeof value.dropproduct === "object" ? value.dropproduct : value;
  const id = product?._id || value?._id || null;
  const name = slugifySegment(product?.name || product?.title);

  if (name) {
    return `/trending/${name}`;
  }

  return id ? `/dropproducts/${id}` : null;
};

export const slugifyDropProductSegment = slugifySegment;
