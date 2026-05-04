import React, { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { buildImageUrl, getResponsiveImageProps } from "../utils/responsiveImage.js";

import {
  fetchHomeSubCategoryTiles,
  selectAllSubCategories,
  selectSubCategoriesLoading,
  selectSubCategoriesError,
} from "../redux/slices/Homepagecategorylist.js";
import { buildProductsListingPath } from "../utils/readymadeRoutes.js";

export default function SubCategoryTilesPage() {
  const dispatch = useDispatch();
  const { categorySlug } = useParams();
  const [searchParams] = useSearchParams();

  const categoryFromQuery = (searchParams.get("category") || "").trim();
  const category = useMemo(() => {
    if (categoryFromQuery) return categoryFromQuery;
    if (categorySlug) return decodeSlug(categorySlug);
    return "T-shirts";
  }, [categoryFromQuery, categorySlug]);

  const subCategories = useSelector(selectAllSubCategories);
  const loading = useSelector(selectSubCategoriesLoading);
  const error = useSelector(selectSubCategoriesError);

  useEffect(() => {
    dispatch(
      fetchHomeSubCategoryTiles({
        onlyActive: true,
        limit: 12,
        category,
      })
    );
  }, [dispatch, category]);

  // Map API data -> tiles UI
  const tiles = useMemo(() => {
    return (subCategories || []).map((item) => {
      const name = item.subCategory || item.name || "Sub Category";

      // ✅ prefer thumbnail
      const rawPath = item.thumbnail || item.image || null;

      return {
        title: name,
        image: rawPath,
        href: buildProductsListingPath(category, name),

        count: item.count ?? null,
      };
    });
  }, [subCategories, category]);

  return (
    <div className="w-full bg-white">
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        {/* Breadcrumb */}
        <nav className="mb-3 text-sm">
          <ol className="flex flex-wrap items-center gap-2 text-gray-600">
            <li className="flex items-center gap-2">
              <Link to="/products" className="text-blue-600 hover:underline">
                All Products
              </Link>
              <span className="text-gray-400">{">"}</span>
            </li>
            <li className="text-gray-700">{category}</li>
          </ol>
        </nav>

        {/* Title */}
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900">
          Custom {category}
        </h1>
        <p className="mt-2 text-lg text-gray-700">
          Make your own custom {category.toLowerCase()}! Custom printing with no minimums.
        </p>

        {/* Loading/Error */}
        {loading && <div className="mt-8 text-gray-600">Loading sub categories...</div>}

        {error && !loading && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Tiles */}
        {!loading && !error && (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {tiles.map((t, idx) => (
              <TileCard
                key={`${t.title}-${idx}`}
                title={t.title}
                image={t.image}   
                href={t.href}
                featured={idx === 0}
              />
            ))}

            {tiles.length === 0 && (
              <div className="col-span-full text-gray-600">No sub categories found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TileCard({ title, image, href, featured = false }) {
  const imageProps = getResponsiveImageProps(image, {
    sizes: featured
      ? "(max-width: 1280px) 100vw, 60vw"
      : "(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 20vw",
  });

  return (
    <Link
      to={href}
      className={[
        "group relative overflow-hidden rounded-xl border border-gray-200 bg-white",
        "transition hover:shadow-md",
        featured ? "xl:col-span-2" : "",
        featured ? "min-h-[320px]" : "min-h-[220px]",
      ].join(" ")}
    >
      <div className="p-6">
        <h3
          className={[
            "whitespace-pre-line leading-tight text-gray-900",
            featured ? "text-3xl font-medium" : "text-2xl font-medium text-center",
          ].join(" ")}
        >
          {title}
        </h3>
      </div>

      {image ? (
        <div
          className={[
            "absolute bottom-0 right-0",
            featured ? "h-[78%] w-[70%]" : "h-[70%] w-[70%]",
          ].join(" ")}
        >
          <img
            src={imageProps.src || buildImageUrl(image)}
            srcSet={imageProps.srcSet}
            sizes={imageProps.sizes}
            alt={title}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            loading={imageProps.loading}
            decoding={imageProps.decoding}
            fetchPriority={imageProps.fetchPriority}
            style={
              imageProps.placeholder
                ? {
                    backgroundImage: `url(${imageProps.placeholder})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="absolute bottom-6 right-6 rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-600">
          No image
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-black/5" />
      </div>
    </Link>
  );
}

function encodeSlug(str = "") {
  return String(str).trim().toLowerCase().replace(/\s+/g, "-");
}

function decodeSlug(slug = "") {
  return String(slug).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
