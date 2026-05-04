// CategoryTilesHorizontal.jsx - Name overlay on image (like screenshot)
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchHomeCategoryTiles,
  selectAllCategories,
  selectCategoriesLoading,
} from "../redux/slices/Homepagecategorylist.js";
import { Link } from "react-router-dom";
import { BiCategoryAlt } from "react-icons/bi"; // optional icon
import { buildProductsListingPath } from "../utils/readymadeRoutes.js";

const IMAGE_URL = import.meta.env.VITE_IMAGE_URL; 

const CategoryTilesHorizontal = ({ limit = 12, onlyActive = true }) => {
  const dispatch = useDispatch();
  const categories = useSelector(selectAllCategories);
  console.log("Homepage Categories:", categories);
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
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-3 pt-6 pb-3">
          <div className="mb-6 flex flex-col items-center justify-center">
            <div className="h-7 w-48 bg-gray-200 rounded-lg animate-pulse mb-1"></div>
            <div className="h-4 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="aspect-square w-full bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (categories.length === 0 && !loading) return null;

  return (
    <div className="bg-white">
      <div className="mx-auto px-3 pt-6 pb-3">
        {/* Centered Header */}
        <div className="mb-6 flex flex-col items-center justify-center">
          <h1 className="text-xl font-medium text-gray-900 mb-1 flex items-center gap-2">
            <BiCategoryAlt className="text-gray-700" />
            Our Categories
          </h1>
          <p className="text-gray-500 text-sm">{categories.length} collections</p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {categories.map((category) => {
            const imageUrl = formatImageUrl(category.thumbnail);
            console.log("Formatted image URL for category", categories);
            const label = titleCase(category.category);

            return (
              <Link
                key={category.category}
                to={buildProductsListingPath(category.category)}
                className="group block"
              >
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-gray-300 transition-all duration-200 hover:shadow-md">
                  {/* Image + overlay name */}
                  <div className="relative aspect-square w-full overflow-hidden">
                                    {imageUrl ? (
                  <>
                    {console.log("Alt text:", category.image.altText)}
                    <img
                      src={imageUrl}
                      alt={category.image.altText || "hebu"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  </>
                ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <span className="text-gray-400 text-2xl font-semibold">
                          {label?.charAt(0) || "C"}
                        </span>
                      </div>
                    )}

                    {/* subtle bottom fade so label always readable */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />

                    {/* Name pill/button on image (like your screenshot) */}
                    <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
                      <div className="flex items-center gap-2 max-w-full px-4 py-1.5 rounded-md bg-white text-gray-900 text-sm font-medium shadow">


                        <span className="text-[13px] font-medium text-gray-900 truncate">
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
      </div>
    </div>
  );
};

export default CategoryTilesHorizontal;
