// Dropproduct.jsx - Name overlay on image (same as CategoryTilesHorizontal)
import React, { useEffect, useRef, useState } from "react";
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

const getProductImages = (product) => {
  const images = [];

  if (product?.thumbnail) {
    const thumbUrl = buildImageUrl(product.thumbnail);
    if (thumbUrl) images.push(thumbUrl);
  }

  if (Array.isArray(product?.images)) {
    product.images.forEach((image) => {
      const imageUrl = buildImageUrl(image);
      if (imageUrl && !images.includes(imageUrl)) {
        images.push(imageUrl);
      }
    });
  }

  return images;
};

const ImageSlider = ({ images, alt }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (images.length <= 1 || isHovered) return;

    timeoutRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [currentIndex, images.length, isHovered]);

  const goToPrevious = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToNext = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  if (!images.length) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <span className="text-gray-400 text-2xl font-semibold">
          {alt?.charAt(0) || "P"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full bg-white"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {images.map((image, index) => (
        <div
          key={`${image}-${index}`}
          className={`absolute inset-0 transition-opacity duration-300 ${
            index === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        >
          <img
            src={image}
            alt={alt}
            className="w-full h-full object-contain p-4"
            loading="lazy"
          />
        </div>
      ))}

      {images.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-sm border border-gray-200 bg-white/90 shadow-sm transition-all duration-200 ${
              isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Previous image"
            type="button"
          >
            <svg className="mx-auto h-4 w-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNext}
            className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-sm border border-gray-200 bg-white/90 shadow-sm transition-all duration-200 ${
              isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Next image"
            type="button"
          >
            <svg className="mx-auto h-4 w-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
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
    <section className="py-4 bg-white">
      {/* Centered Header with Icon */}
      <div className="container mx-auto px-4">
        <div className="mb-6 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <Package className="w-5 h-5 text-gray-600" />
            <h1 className="text-xl font-medium text-gray-900">Trending</h1>
          </div>
          {/* <p className="text-gray-500 text-sm">{products.length} items available</p> */}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {products.map((product) => {
            const images = getProductImages(product);
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
                <div className="mx-auto max-w-[220px] overflow-hidden rounded-lg bg-white transition-all duration-200 hover:shadow-md">
                  {/* Product Image + overlay name */}
                  <div className="relative aspect-[4/5] w-full overflow-hidden">
                    {showOfferTag && discountPercent > 0 ? (
                      <div className="absolute left-2 top-2 z-10 rounded-full bg-red-500 px-2 py-1 text-[10px] font-bold text-white shadow">
                        {discountPercent}% OFF
                      </div>
                    ) : null}

                    <ImageSlider images={images} alt={label} />

                    {/* subtle bottom fade so label always readable */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />

                    {/* Name badge on image (same as categories) */}
                    <div className="absolute inset-x-0 bottom-2 flex justify-center px-2">
                      <div className="flex max-w-full items-center gap-2 rounded-md bg-white px-3 py-1.5 text-gray-900 shadow">
                        <span className="truncate text-xs font-medium text-gray-900 sm:text-sm">
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
    </section>
  );
};

export default Dropproduct;
