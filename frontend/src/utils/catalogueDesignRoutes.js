export const buildCatalogueDesignPath = (design) => {
  return design?._id ? `/catalogue/${design._id}` : null;
};
