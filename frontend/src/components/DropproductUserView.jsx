// Dropproduct.jsx - Name overlay on image (same as CategoryTilesHorizontal)
import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  getAllDropproducts,
  selectAllProducts,
  selectLoading,
} from "../redux/slices/dropproducts.js";
import { Package } from "lucide-react";
import { buildImageUrl } from "../utils/responsiveImage.js";

const hasActiveOffer = (product) => {
  const mrp = Number(product?.minPrice || 0);
  const sale = Number(product?.salePrice || 0);
  if (!(mrp > 0) || !(sale > 0) || !(sale < mrp)) return false;

  const now = new Date();
  const start = product?.saleStartAt ? new Date(product.saleStartAt) : null;
  const end = product?.saleEndAt ? new Date(product.saleEndAt) : null;

  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

const getOfferDiscountPercent = (product) => {
  const mrp = Number(product?.minPrice || 0);
  const sale = Number(product?.salePrice || 0);
  if (!(mrp > 0) || !(sale > 0) || !(sale < mrp)) return 0;
  return Math.round(((mrp - sale) / mrp) * 100);
};

const Dropproduct = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const products = useSelector(selectAllProducts);
  const loading = useSelector(selectLoading);

  useEffect(() => {
    dispatch(getAllDropproducts());
  }, [dispatch]);

  const handleProductClick = (productId) => {
    navigate(`/dropproducts/${productId}`);
  };

  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      {/* Centered Header with Icon */}
      <div className="mx-auto px-3 pt-6 pb-3">
        <div className="mb-6 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <Package className="w-5 h-5 text-gray-600" />
            <h1 className="text-xl font-medium text-gray-900">Trending</h1>
          </div>
          {/* <p className="text-gray-500 text-sm">{products.length} items available</p> */}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {products.map((product) => {
            const imageUrl = buildImageUrl(product.thumbnail || product.images?.[0]);
            const label = product.name || "Product";
            const showOfferTag = hasActiveOffer(product);
            const discountPercent = showOfferTag ? getOfferDiscountPercent(product) : 0;

            return (
              <div
                key={product._id}
                className="cursor-pointer group"
                onClick={() => handleProductClick(product._id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleProductClick(product._id);
                }}
              >
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-gray-300 transition-all duration-200 hover:shadow-md">
                  {/* Product Image + overlay name */}
                  <div className="relative aspect-square w-full overflow-hidden">
                    {showOfferTag && discountPercent > 0 ? (
                      <div className="absolute left-2 top-2 z-10 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                        {discountPercent}% OFF
                      </div>
                    ) : null}

                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <span className="text-gray-400 text-2xl font-semibold">
                          {label?.charAt(0) || "P"}
                        </span>
                      </div>
                    )}

                    {/* subtle bottom fade so label always readable */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />

                    {/* Name badge on image (same as categories) */}
                    <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
                      <div className="flex items-center gap-2 max-w-full px-4 py-1.5 rounded-md bg-white text-gray-900 text-sm font-medium shadow">
                        <span className="text-[13px] font-medium text-gray-900 truncate">
                          {label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Removed below-name block to match category style */}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dropproduct;
