// CategoryTilesHorizontal.jsx - "Shop by category" photo tiles on the homepage
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchHomeCategoryTiles,
  selectAllCategories,
  selectCategoriesLoading,
} from "../redux/slices/Homepagecategorylist.js";
import { Link } from "react-router-dom";
import { buildProductsListingPath } from "../utils/readymadeRoutes.js";
import { CategoryTile, SectionHeader, Skeleton } from "./ui/index.js";

const IMAGE_URL = import.meta.env.VITE_IMAGE_URL; 

const CategoryTilesHorizontal = ({ limit = 12, onlyActive = true }) => {
  const dispatch = useDispatch();
  const categories = useSelector(selectAllCategories);
  const loading = useSelector(selectCategoriesLoading);

  useEffect(() => {
    dispatch(fetchHomeCategoryTiles({ limit, onlyActive }));
  }, [dispatch, limit, onlyActive]);

  const formatImageUrl = (imagePath) => {
  if (!imagePath) return null;

  // already absolute
  if (imagePath.startsWith("http")) return imagePath;

  // backend-served static paths
  if (
    imagePath.startsWith("/uploads/") ||
    imagePath.startsWith("/outputs/")
  ) {
    return `${IMAGE_URL}${imagePath}`;
  }

  // fallback
  return `${IMAGE_URL}/${imagePath}`;
};


  const titleCase = (str = "") =>
    str ? str.charAt(0).toUpperCase() + str.slice(1) : "";

  if (loading && categories.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12">
        <Skeleton className="mb-4 h-7 w-44" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="aspect-[16/11] w-full sm:aspect-[4/3] lg:aspect-[4/5]" />
          ))}
        </div>
      </section>
    );
  }

  if (categories.length === 0 && !loading) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-10">
      <SectionHeader title="Shop by category" actionTo="/products" className="mb-3 sm:mb-5" />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {categories.map((category) => {
          const imageUrl = formatImageUrl(category.thumbnail);
          const label = titleCase(category.category);

          return imageUrl ? (
            <CategoryTile
              aspect="aspect-[16/11] sm:aspect-[4/3] lg:aspect-[4/5]"
              key={category.category}
              to={buildProductsListingPath(category.category)}
              image={imageUrl}
              imageAlt={category.image?.altText || label}
              label={label}
            />
          ) : (
            <Link
              key={category.category}
              to={buildProductsListingPath(category.category)}
              className="relative flex aspect-[16/11] sm:aspect-[4/3] lg:aspect-[4/5] items-center justify-center rounded-mt-btn bg-mt-surface-raised text-3xl font-light text-mt-subtle"
            >
              {label?.charAt(0) || "C"}
              <span className="absolute bottom-2.5 left-3 text-[13px] text-mt-text sm:bottom-4 sm:left-4 sm:text-base">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default CategoryTilesHorizontal;
