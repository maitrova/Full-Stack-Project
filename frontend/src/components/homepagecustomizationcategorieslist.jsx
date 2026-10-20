// homepagecustomizationcategorieslist.jsx - "Customizable categories" tiles (2 per row on mobile)
import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchProductCategories,
  selectProductCategories,
  selectCategoriesLoading,
  selectCategoriesError,
  clearError,
} from "../redux/slices/productcategories.js";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import { SectionHeader, Skeleton } from "./ui/index.js";

const IMAGE_URL = import.meta.env.VITE_IMAGE_URL; 

const HomepageCustomizationCategoriesList = () => {
  const dispatch = useDispatch();
  const categories = useSelector(selectProductCategories);
  const loading = useSelector(selectCategoriesLoading);
  const error = useSelector(selectCategoriesError);
  const containerRef = useRef(null);

  useEffect(() => {
    dispatch(fetchProductCategories());
  }, [dispatch]);

  const formatImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith("http")) return imagePath;
    if (imagePath.startsWith("/uploads/")) return `${IMAGE_URL}${imagePath}`;
    return `${IMAGE_URL}/${imagePath}`;
  };

  // Skeleton loader
  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
        <Skeleton className="mb-4 h-7 w-56" />
        <div className="flex gap-2 overflow-hidden sm:gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="aspect-[5/4] w-[calc(50%-0.25rem)] shrink-0 sm:w-[280px]" />
          ))}
        </div>
      </section>
    );
  }

  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
      <SectionHeader
        title="Customizable categories"
        actionTo="/customproducts"
        className="mb-3 sm:mb-5"
      />

      <div
        ref={containerRef}
        className="grid grid-cols-2 gap-2 sm:flex sm:snap-x sm:gap-3 sm:overflow-x-auto sm:pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {categories.map((category) => {
          const imageUrl = formatImageUrl(category.image);
          const label = category.category;

          return (
            <Link
              key={category._id || category.category}
              to={`/customproducts?category=${category.category}`}
              className="group relative block aspect-[5/4] w-full overflow-hidden rounded-mt-btn bg-mt-surface-raised font-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mt-text sm:w-[280px] sm:shrink-0 sm:snap-start"
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={label}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%231f1f21'/%3E%3Cpath d='M35 40l15 15 15-15' stroke='%238e8e93' stroke-width='2' fill='none'/%3E%3C/svg%3E";
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Settings className="h-9 w-9 text-mt-subtle" aria-hidden="true" />
                </div>
              )}

              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-b from-transparent to-black/65"
              />
              <span className="absolute bottom-2.5 left-3 text-[13px] text-white sm:bottom-4 sm:left-4 sm:text-base">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default HomepageCustomizationCategoriesList;
