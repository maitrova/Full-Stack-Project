// homepagecustomizationcategorieslist.jsx - UPDATED (no arrows, 2 cards on mobile)
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
      <section className="bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center mb-2">
              <Settings className="w-5 h-5 mr-2" />
              <h1 className="text-2xl font-bold text-gray-900">
                Customizable Categories
              </h1>
            </div>
            <div className="h-4 w-64 bg-gray-200 rounded mx-auto animate-pulse"></div>
          </div>

          <div className="flex overflow-x-auto scrollbar-hide gap-1 pb-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="w-[48%] sm:w-[280px] flex-shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden animate-pulse"
              >
                <div className="h-56 sm:h-64 bg-gray-200"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) {
    return (
      <section className="bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto text-center">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Customizable Categories Available
            </h2>
            <p className="text-gray-600">
              Customizable categories will be added soon.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center mb-2">
            <Settings className="w-5 h-5 mr-2" />
            <h1 className="text-2xl font-bold text-gray-900">
              Customizable Categories
            </h1>
          </div>
          <p className="text-gray-600 text-sm">
            Choose a category to customize your products
          </p>
        </div>

        {/* Categories (no scroll buttons) */}
        {/* Categories */}
<div
  ref={containerRef}
  className="
    grid grid-cols-2 gap-1
    sm:flex sm:overflow-x-auto sm:gap-1 sm:pb-4
    scrollbar-hide
  "
  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
>
  {categories.map((category) => {
    const imageUrl = formatImageUrl(category.image);
    const label = category.category;

    return (
      <Link
        key={category._id || category.category}
        to={`/customproducts?category=${category.category}`}
        className="w-full sm:min-w-[280px] sm:max-w-[280px] sm:flex-shrink-0"
      >
        <div className="group bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300">
          <div className="relative h-44 sm:h-64 bg-gray-50 overflow-hidden">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={label}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src =
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Cpath d='M35 40l15 15 15-15' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3C/svg%3E";
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                <Settings className="w-10 h-10 text-gray-400" />
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/30 to-transparent" />

            <div className="absolute inset-x-0 bottom-2 flex justify-center px-2">
              <div className="max-w-full px-3 py-1.5 rounded-md bg-white text-gray-900 shadow">
                <span className="text-xs sm:text-sm font-medium truncate block">
                  {label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  })}
</div>


        {/* Footer */}
        {categories.length > 0 && (
          <div className="mt-4 text-center">
            <div className="text-xs text-gray-500 mb-2">
              Showing {categories.length} customizable categories
            </div>
            <Link
              to="/customproducts"
              className="inline-block text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              View All Categories →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default HomepageCustomizationCategoriesList;
