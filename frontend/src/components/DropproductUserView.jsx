// DropproductUserView.jsx - "Trending" drop products grid on the homepage
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  getAllDropproducts,
  selectAllProducts,
  selectLoading,
} from "../redux/slices/dropproducts.js";
import { SectionHeader, Skeleton } from "./ui/index.js";
import { buildImageUrl, getImageAltText } from "../utils/responsiveImage.js";
import { buildDropProductPath } from "../utils/dropProductRoutes.js";

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

  if (Array.isArray(product?.images)) {
    product.images.forEach((image) => {
      const nextImageUrl = buildImageUrl(image);
      if (nextImageUrl && !images.some((entry) => entry.src === nextImageUrl)) {
        images.push({
          src: nextImageUrl,
          altText: getImageAltText(image, product?.name || "Product"),
        });
      }
    });
  }

  if (!images.length && product?.thumbnail) {
    const thumbUrl = buildImageUrl(product.thumbnail);
    if (thumbUrl) images.push({ src: thumbUrl, altText: product?.name || "Product" });
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
      <div className="w-full h-full flex items-center justify-center bg-mt-photo">
        <span className="text-mt-subtle text-2xl font-light">
          {alt?.charAt(0) || "P"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full bg-mt-photo"
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
            src={typeof image === "string" ? image : image.src}
            alt={typeof image === "string" ? alt : image.altText || alt}
            className="w-full h-full object-contain p-4"
            loading="lazy"
          />
        </div>
      ))}

      {images.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 transition-all duration-200 ${
              isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Previous image"
            type="button"
          >
            <svg className="mx-auto h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNext}
            className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 transition-all duration-200 ${
              isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-label="Next image"
            type="button"
          >
            <svg className="mx-auto h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  const handleProductClick = (product) => {
    const path = buildDropProductPath(product);
    if (path) navigate(path);
  };

  if (loading && products.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
        <Skeleton className="mb-4 h-7 w-32" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} className="aspect-[4/5] w-full" />
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
      <SectionHeader title="Trending" className="mb-3 sm:mb-5" />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
        {products.map((product) => {
          const images = getProductImages(product);
          const label = product.name || "Product";
          const showOfferTag = hasActiveOffer(product);
          const discountPercent = showOfferTag ? getOfferDiscountPercent(product) : 0;

          return (
            <div
              key={product._id}
              className="group cursor-pointer rounded-mt-btn font-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mt-text"
              onClick={() => handleProductClick(product)}
              role="link"
              tabIndex={0}
              aria-label={label}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleProductClick(product);
              }}
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-mt-btn bg-mt-photo">
                {showOfferTag && discountPercent > 0 ? (
                  <span className="absolute left-2 top-2 z-10 rounded-mt-btn bg-black/80 px-2 py-0.5 text-[10px] font-medium text-white">
                    {discountPercent}% off
                  </span>
                ) : null}

                <ImageSlider images={images} alt={label} />
              </div>
              <p className="mt-2 truncate text-sm text-mt-text">{label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default Dropproduct;
