import React from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

const STATIC_ROUTE_MAP = {
  "/products": [{ label: "Products", to: "/products" }],
  "/products-legacy": [{ label: "Products", to: "/products" }],
  "/allproducts": [{ label: "Products", to: "/products" }],
  "/catalogue": [{ label: "Catalogue", to: "/catalogue" }],
  "/cart": [{ label: "Cart", to: "/cart" }],
  "/profile": [{ label: "Profile", to: "/profile" }],
  "/orders": [{ label: "Orders", to: "/orders" }],
  "/checkout": [{ label: "Checkout", to: "/checkout" }],
  "/checkoutpage": [{ label: "Checkout", to: "/checkoutpage" }],
  "/subcategory": [{ label: "Products", to: "/products" }],
};

const HIDDEN_PREFIXES = [
  "/login",
  "/register",
  "/admin",
  "/adminpage",
  "/admindashboard",
  "/dashboard",
  "/productmanager",
  "/publish-design",
  "/searchpage",
  "/ProductSearch",
  "/usersaved_designs",
  "/usersaveddesigns",
  "/customproducts",
  "/readymade/products",
  "/price",
  "/managementorders",
];

const humanizeSegment = (value = "") =>
  String(value || "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildBreadcrumbs = (pathname, search) => {
  if (pathname === "/") return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  const productDetailMatch = matchPath("/products/:categoryName/:subCategoryName/:productSlug", pathname);
  if (productDetailMatch) {
    const { categoryName, subCategoryName, productSlug } = productDetailMatch.params;
    return [
      { label: "Products", to: "/products" },
      { label: humanizeSegment(categoryName), to: `/products/${categoryName}` },
      {
        label: humanizeSegment(subCategoryName),
        to: `/products/${categoryName}/${subCategoryName}`,
      },
      { label: humanizeSegment(productSlug) },
    ];
  }

  const productSubCategoryMatch = matchPath("/products/:categoryName/:subCategoryName", pathname);
  if (productSubCategoryMatch) {
    const { categoryName, subCategoryName } = productSubCategoryMatch.params;
    return [
      { label: "Products", to: "/products" },
      { label: humanizeSegment(categoryName), to: `/products/${categoryName}` },
      { label: humanizeSegment(subCategoryName) },
    ];
  }

  const productCategoryMatch = matchPath("/products/:categoryName", pathname);
  if (productCategoryMatch) {
    const { categoryName } = productCategoryMatch.params;
    return [
      { label: "Products", to: "/products" },
      { label: humanizeSegment(categoryName) },
    ];
  }

  const trendingMatch = matchPath("/trending/:slug", pathname);
  if (trendingMatch) {
    return [
      { label: "Trending", to: "/trending" },
      { label: humanizeSegment(trendingMatch.params.slug) },
    ];
  }

  const legacyTrendingMatch = matchPath("/dropproducts/:id", pathname);
  if (legacyTrendingMatch) {
    return [
      { label: "Trending", to: "/trending" },
      { label: "Product" },
    ];
  }

  const blogMatch = matchPath("/blogs/:slug", pathname);
  if (blogMatch) {
    return [
      { label: "Blogs" },
      { label: humanizeSegment(blogMatch.params.slug) },
    ];
  }

  const catalogueDetailMatch = matchPath("/catalogue/:id", pathname);
  if (catalogueDetailMatch) {
    return [
      { label: "Catalogue", to: "/catalogue" },
      { label: "Design" },
    ];
  }

  if (pathname === "/checkout/success") {
    return [
      { label: "Checkout", to: "/checkout" },
      { label: "Order Success" },
    ];
  }

  if (pathname === "/subcategory") {
    const params = new URLSearchParams(search);
    const category = params.get("category");
    return [
      { label: "Products", to: "/products" },
      ...(category ? [{ label: humanizeSegment(category) }] : []),
      { label: "Sub Categories" },
    ];
  }

  if (STATIC_ROUTE_MAP[pathname]) {
    return STATIC_ROUTE_MAP[pathname];
  }

  const singlePageMatch = matchPath("/:name", pathname);
  if (singlePageMatch) {
    return [{ label: humanizeSegment(singlePageMatch.params.name) }];
  }

  return null;
};

export default function Breadcrumbs() {
  const location = useLocation();
  const items = buildBreadcrumbs(location.pathname, location.search);

  if (!items || items.length === 0) return null;

  return (
    <div className="border-b border-gray-100 bg-white">
      <div className="mx-auto hidden max-w-7xl px-4 py-3 sm:block sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <li>
              <Link to="/" className="transition-colors hover:text-gray-900">
                Home
              </Link>
            </li>

            {items.map((item, index) => {
              const isLast = index === items.length - 1;

              return (
                <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  {item.to && !isLast ? (
                    <Link to={item.to} className="transition-colors hover:text-gray-900">
                      {item.label}
                    </Link>
                  ) : (
                    <span className={isLast ? "font-medium text-gray-900" : ""}>{item.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}
