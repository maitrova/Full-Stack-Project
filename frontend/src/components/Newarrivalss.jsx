import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  fetchHomepageNewArrivals,
  selectNewArrivalsSelectedItemsFull,
  selectNewArrivalsSelectedLoading,
  selectNewArrivalsSelectedError,
} from "../redux/slices/HomepageSlice.js";
import { Link } from "react-router-dom";

const NewArrivals = () => {
  const dispatch = useDispatch();
  
  const items = useSelector(selectNewArrivalsSelectedItemsFull);
  const loading = useSelector(selectNewArrivalsSelectedLoading);
  const error = useSelector(selectNewArrivalsSelectedError);

  const [currentScrollIndex, setCurrentScrollIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    dispatch(fetchHomepageNewArrivals());
  }, [dispatch]);

  // Image normalization
  const getItemImages = (item) => {
    let imgs = Array.isArray(item.previewImages) ? item.previewImages.filter(Boolean) : [];

    if (!imgs.length) {
      if (item.previewImage) imgs = [item.previewImage];
      else if (item.imageUrl) imgs = [item.imageUrl];
    }

    if (item.type === "readymade") {
      imgs = imgs.map((src) => {
        if (!src) return "";
        if (src.startsWith("http://") || src.startsWith("https://")) return src;
        const cleanSrc = src.startsWith("/") ? src : `/${src}`;
        return `${import.meta.env.VITE_IMAGE_URL}${cleanSrc}`;

      });
    }

    return imgs.filter(img => img && img.trim() !== "");
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
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      );
    }

    return (
      <div 
        className="relative w-full h-full bg-white"
        onMouseEnter={() => setIsImageHovered(true)}
        onMouseLeave={() => setIsImageHovered(false)}
      >
        {/* Main Image */}
        <div className="relative w-full h-full">
          {images.map((img, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-300 ${
                index === currentIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <img
                src={img}
                alt={`${alt} - ${index + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Cpath d='M35 40l15 15 15-15' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3C/svg%3E";
                }}
                loading="lazy"
              />
            </div>
          ))}
        </div>

        {/* Navigation - Show on hover */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 hover:bg-white 
                border border-gray-200 rounded-sm flex items-center justify-center shadow-sm 
                transition-all duration-200 ${isImageHovered ? "opacity-100" : "opacity-0"}`}
              aria-label="Previous image"
              type="button"
            >
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={nextSlide}
              className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 hover:bg-white 
                border border-gray-200 rounded-sm flex items-center justify-center shadow-sm 
                transition-all duration-200 ${isImageHovered ? "opacity-100" : "opacity-0"}`}
              aria-label="Next image"
              type="button"
            >
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    
    return (
      <Link
        to={`/${item.type === "design" ? "catalogue" : "products"}/${item._id}`}
        className="group block bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300"
      >
        {/* Image Section with name overlay */}
        <div className="relative h-64 bg-gray-50 overflow-hidden">
          <ImageSlider 
            images={images} 
            alt={label}
            autoScrollInterval={4000}
          />
          
          {/* Gradient overlay at bottom for readability */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
          
          {/* Name badge on image (like Dropproduct) */}
          <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
            <div className="flex items-center gap-2 max-w-full px-4 py-2 rounded-md bg-white text-gray-900 shadow">
              <span className="text-sm font-medium text-gray-900 truncate">
                {label}
              </span>
            </div>
          </div>
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

  // Loading State
  if (loading) {
    return (
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-2">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h1 className="text-2xl font-bold text-gray-900">New Arrivals</h1>
            </div>
            <div className="h-4 w-64 bg-gray-200 rounded mx-auto animate-pulse"></div>
          </div>

          <div className="flex overflow-x-auto scrollbar-hide gap-4 pb-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="min-w-[280px] max-w-[280px] flex-shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden animate-pulse">
                <div className="h-64 bg-gray-200"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Error State
  if (error) {
    return (
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.73 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load New Arrivals</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => dispatch(fetchHomepageNewArrivals())}
              className="text-sm text-gray-700 hover:text-gray-900 underline"
              type="button"
            >
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Empty State
  if (!items || items.length === 0) {
    return (
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No New Arrivals Available</h2>
            <p className="text-gray-600">New arrivals will be added soon.</p>
          </div>
        </div>
      </section>
    );
  }

  // Main Render
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-2">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900">New Arrivals</h1>
          </div>
          <p className="text-gray-600 text-sm">
            Explore our latest collection
          </p>
        </div>

        {/* Products Container with Scroll */}
        <div
          className="relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Left Scroll Button - show always on mobile, hover on desktop */}
          {items.length > 2 && (
            <button
              onClick={scrollLeft}
              className={`
                absolute left-0 top-1/2 -translate-y-1/2 z-10
                w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm
                hover:bg-gray-50 transition-all duration-200
                opacity-100
                sm:-translate-x-4 sm:${isHovered ? "opacity-100" : "opacity-0 pointer-events-none"}
              `}
              aria-label="Scroll left"
              type="button"
            >
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Products - Mobile shows 2 items, horizontal scroll */}
          <div
            ref={containerRef}
            className="flex overflow-x-auto scrollbar-hide pb-4
                       gap-3 sm:gap-4
                       px-10 sm:px-0"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {items.map((item) => (
              <div
                key={`${item.type}-${item._id}`}
                className="
                  flex-shrink-0
                  w-[calc(50%-0.375rem)]   /* mobile: 2 items */
                  sm:min-w-[280px] sm:max-w-[280px]
                "
              >
                <ProductCard item={item} />
              </div>
            ))}
          </div>

          {/* Right Scroll Button - show always on mobile, hover on desktop */}
          {items.length > 2 && (
            <button
              onClick={scrollRight}
              className={`
                absolute right-0 top-1/2 -translate-y-1/2 z-10
                w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm
                hover:bg-gray-50 transition-all duration-200
                opacity-100
                sm:translate-x-4 sm:${isHovered ? "opacity-100" : "opacity-0 pointer-events-none"}
              `}
              aria-label="Scroll right"
              type="button"
            >
              <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Footer - Small */}
        {items.length > 0 && (
          <div className="mt-8 text-center">
            <div className="text-xs text-gray-500 mb-2">
              Showing {items.length} new arrivals
            </div>
            <Link
              to="/allproducts?filter=newArrivals"
              className="inline-block text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              View All →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default NewArrivals;