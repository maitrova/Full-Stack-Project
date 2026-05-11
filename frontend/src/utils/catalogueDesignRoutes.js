const slugifyDesignSegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildCatalogueDesignPath = (design) => {
  const slug = slugifyDesignSegment(design?.title || design?.productName || design?.name);
  return slug ? `/catalogue/${slug}` : (design?._id ? `/catalogue/${design._id}` : null);
};

export { slugifyDesignSegment };
