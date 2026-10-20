import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  fetchHomepageBestSellers,
  selectBestSellersSelectedItemsFull,
  selectBestSellersSelectedLoading,
  selectBestSellersSelectedError,
} from "../redux/slices/HomepageSlice.js";
import { Link } from "react-router-dom";
import { buildImageUrl, getRawImagePath, getResponsiveImageProps } from "../utils/responsiveImage.js";
import { formatHomepagePrice, getHomepageItemPricing } from "../utils/homepageProductPricing.js";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, SectionHeader, Skeleton } from "./ui/index.js";
import { buildReadymadeProductPath } from "../utils/readymadeRoutes.js";
import { buildCatalogueDesignPath } from "../utils/catalogueDesignRoutes.js";

const BestSellers = () => {
  const dispatch = useDispatch();
  
  const items = useSelector(selectBestSellersSelectedItemsFull);
  const loading = useSelector(selectBestSellersSelectedLoading);
  const error = useSelector(selectBestSellersSelectedError);

  const [currentScrollIndex, setCurrentScrollIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    dispatch(fetchHomepageBestSellers());
  }, [dispatch]);

  // Image normalization
  // Image normalization with altText support
const getItemImages = (item) => {
  let imgs = Array.isArray(item.previewImages)
    ? item.previewImages.filter(Boolean)
    : [];

  if (!imgs.length) {
    if (item.previewImage) imgs = [item.previewImage];
    else if (item.imageUrl) imgs = [item.imageUrl];
  }

  return imgs
    .map((image) => {
      const rawPath = getRawImagePath(image);
      if (!rawPath) return null;

      return {
        image: rawPath,
        altText:
          (typeof image === "object" ? image.altText : "") ||
          item.title ||
          "Product image",
      };
    })
    .filter(Boolean);
};


  // Image Slider Component - Simplified
  const ImageSlider = ({ images = [], alt = "", autoScrollInterval = 4000 }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isImageHovered, setIsImageHovered] = useState(false);
    const timeoutRef = useRef(null);

    useEffect(() => {
      if (images.length <= 1) return;

      const startAutoScroll = () => {
        if (!isImageHovered) {
          timeoutRef.current = setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % images.length);
          }, autoScrollInterval);
        }
      };

      startAutoScroll();

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [currentIndex, images.length, autoScrollInterval, isImageHovered]);

    const nextSlide = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      setCurrentIndex((prev) => (prev + 1) % images.length);
      resetAutoScroll();
    };

    const prevSlide = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
      resetAutoScroll();
    };

    const resetAutoScroll = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };

    if (!images.length) {
      return (
        <div className="w-full h-full bg-mt-photo flex items-center justify-center">
          <svg className="w-12 h-12 text-mt-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      );
    }

    return (
      <div 
        className="relative w-full h-full bg-mt-photo"
        onMouseEnter={() => setIsImageHovered(true)}
        onMouseLeave={() => setIsImageHovered(false)}
      >
        {/* Main Image */}
        <div className="relative w-full h-full">
        {images.map((imgObj, index) => (
              
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-300 ${
                index === currentIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              {(() => {
                const imageProps = getResponsiveImageProps(imgObj.image, {
                  sizes: "(max-width: 640px) 50vw, 280px",
                  loading: index === currentIndex ? "eager" : "lazy",
                });

                return (
              <img
                    src={imageProps.src || buildImageUrl(imgObj.image)}
                    srcSet={imageProps.srcSet}
                    sizes={imageProps.sizes}
                    alt={imgObj.altText}
                    className="w-full h-full object-contain transition-transform duration-200"
                    loading={imageProps.loading}
                    decoding={imageProps.decoding}
                    fetchPriority={imageProps.fetchPriority}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' font-size='12' text-anchor='middle' fill='%239ca3af'%3ENo Image%3C/text%3E%3C/svg%3E";
                    }}
                  />
                );
              })()}

            </div>
          ))}
        </div>

        {/* Navigation - Show on hover */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/60 hover:bg-black/80 
                rounded-full flex items-center justify-center 
                transition-all duration-200 ${isImageHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
              aria-label="Previous image"
              type="button"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={nextSlide}
              className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/60 hover:bg-black/80 
                rounded-full flex items-center justify-center 
                transition-all duration-200 ${isImageHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
              aria-label="Next image"
              type="button"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    );
  };

  // Product Card Component
  const ProductCard = ({ item }) => {
    const images = getItemImages(item);
    const label = item.name || item.title;
    const pricing = getHomepageItemPricing(item);
    const detailPath = item.type === "design" ? (buildCatalogueDesignPath(item) || `/catalogue/${item._id}`) : (buildReadymadeProductPath(item) || `/readymade/${item._id}`);

    return (
      <Link to={detailPath} className="group block font-brand">
        <div className="relative aspect-[4/5] overflow-hidden rounded-mt-btn bg-mt-photo">
          <ImageSlider
            images={images}
            alt={label}
            autoScrollInterval={4000}
          />
          {pricing.hasOffer && (
            <span className="absolute left-2 top-2 z-10 rounded-mt-btn bg-black/80 px-2 py-0.5 text-[10px] font-medium text-white">
              {pricing.discountPercent}% off
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-col gap-0.5">
          <span className="truncate text-sm text-mt-text">{label}</span>
          {pricing.currentPrice > 0 && (
            <span className="flex items-baseline gap-2 text-xs text-mt-muted sm:text-sm">
              {formatHomepagePrice(pricing.currentPrice, pricing.currency)}
              {pricing.hasOffer && (
                <span className="text-[11px] text-mt-subtle line-through">
                  {formatHomepagePrice(pricing.originalPrice, pricing.currency)}
                </span>
              )}
            </span>
          )}
        </div>
      </Link>
    );
  };

  // Scroll functionality
  const scrollLeft = () => {
    if (containerRef.current) {
      const scrollAmount = containerRef.current.offsetWidth;
      containerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      setCurrentScrollIndex(prev => Math.max(0, prev - 1));
    }
  };

  const scrollRight = () => {
    if (containerRef.current) {
      const scrollAmount = containerRef.current.offsetWidth;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      const maxIndex = Math.ceil(items.length / 4) - 1;
      setCurrentScrollIndex(prev => Math.min(maxIndex, prev + 1));
    }
  };
  const scrollButtonClasses = `absolute top-[38%] z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-mt-line-strong bg-mt-surface/90 text-mt-text backdrop-blur transition-opacity duration-200 hover:bg-mt-surface-raised sm:flex ${
    isHovered ? "opacity-100" : "pointer-events-none opacity-0"
  }`;

  // Loading State
  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
        <Skeleton className="mb-4 h-7 w-40" />
        <div className="flex gap-2 overflow-hidden sm:gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-[calc(50%-0.25rem)] shrink-0 sm:w-[220px] lg:w-[240px]">
              <Skeleton className="aspect-[4/5] w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Error State
  if (error) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
        <SectionHeader title="Best sellers" className="mb-3 sm:mb-5" />
        <div className="rounded-mt-card border border-mt-line bg-mt-surface px-5 py-8 text-center">
          <p className="text-sm text-mt-text">Unable to load best sellers</p>
          <p className="mt-1 text-xs text-mt-subtle">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => dispatch(fetchHomepageBestSellers())}
          >
            Retry
          </Button>
        </div>
      </section>
    );
  }

  // Empty State
  if (!items || items.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
        <SectionHeader title="Best sellers" className="mb-3 sm:mb-5" />
        <div className="rounded-mt-card border border-mt-line bg-mt-surface px-5 py-8 text-center">
          <p className="text-sm text-mt-text">No best sellers yet</p>
          <p className="mt-1 text-xs text-mt-subtle">Best sellers will be updated soon.</p>
        </div>
      </section>
    );
  }

  // Main Render
  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
      <SectionHeader title="Best sellers" actionTo="/products?filter=bestSellers" className="mb-3 sm:mb-5" />

      <div
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {items.length > 2 && (
          <button
            onClick={scrollLeft}
            className={`${scrollButtonClasses} -left-3`}
            aria-label="Scroll left"
            type="button"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}

        {/* Mobile shows 2 items per screen; swipe to scroll */}
        <div
          ref={containerRef}
          className="flex snap-x gap-2 overflow-x-auto pb-2 sm:gap-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <div
              key={`${item.type}-${item._id}`}
              className="w-[calc(50%-0.25rem)] shrink-0 snap-start sm:w-[220px] lg:w-[240px]"
            >
              <ProductCard item={item} />
            </div>
          ))}
        </div>

        {items.length > 2 && (
          <button
            onClick={scrollRight}
            className={`${scrollButtonClasses} -right-3`}
            aria-label="Scroll right"
            type="button"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
};

export default BestSellers;
