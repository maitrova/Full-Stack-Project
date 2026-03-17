import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { buildImageUrl, getRawImagePath, getResponsiveImageProps } from "../utils/responsiveImage.js";

// Shared components
const ImageSlider = ({ images = [], alt = "", autoScrollInterval = 4000 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (images.length <= 1) return;

    const startAutoScroll = () => {
      if (!isHovered) {
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
  }, [currentIndex, isHovered, images.length, autoScrollInterval]);

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
            {(() => {
              const imageProps = getResponsiveImageProps(img, {
                sizes: "(max-width: 640px) 50vw, 280px",
                loading: index === currentIndex ? "eager" : "lazy",
              });

              return (
                <img
                  src={imageProps.src || buildImageUrl(img)}
                  srcSet={imageProps.srcSet}
                  sizes={imageProps.sizes}
                  alt={`${alt} - ${index + 1}`}
                  className="w-full h-full object-contain"
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
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Cpath d='M35 40l15 15 15-15' stroke='%239ca3af' stroke-width='2' fill='none'/%3E%3C/svg%3E";
                  }}
                />
              );
            })()}
          </div>
        ))}
      </div>

      {/* Navigation */}
      {images.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 hover:bg-white 
              border border-gray-200 rounded-sm flex items-center justify-center shadow-sm 
              transition-all duration-200 ${isHovered ? "opacity-100" : "opacity-0"}`}
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
              transition-all duration-200 ${isHovered ? "opacity-100" : "opacity-0"}`}
            aria-label="Next image"
            type="button"
          >
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1 z-10">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentIndex(index);
                  resetAutoScroll();
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                  index === currentIndex 
                    ? "bg-gray-900" 
                    : "bg-gray-400 hover:bg-gray-600"
                }`}
                aria-label={`Go to slide ${index + 1}`}
                type="button"
              />
            ))}
          </div>

          {/* Counter */}
          {images.length > 1 && (
            <div className="absolute top-3 right-3 z-10">
              <div className="bg-black/80 text-white text-xs px-2 py-1 rounded-sm">
                {currentIndex + 1}/{images.length}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ProductCard = ({ item, getItemImages }) => {
  const images = getItemImages(item);
  
  return (
    <div className="group bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-300">
      {/* Image Section */}
      <div className="relative h-64 bg-gray-50">
        <ImageSlider 
          images={images} 
          alt={item.name || item.title}
          autoScrollInterval={4000}
        />
      </div>

      {/* Content Section */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-lg line-clamp-1 mb-2">
          {item.name || item.title}
        </h3>
        
        {item.description && (
          <p className="text-gray-600 text-sm line-clamp-2 mb-4">
            {item.description}
          </p>
        )}

        {/* Price and Type */}
        <div className="flex items-center justify-between mb-3">
          {item.price && (
            <span className="font-medium text-gray-900">
              {new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: item.currency || 'INR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(item.price)}
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-1 rounded ${
            item.type === 'design' 
              ? 'bg-purple-100 text-purple-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {item.type === 'design' ? 'Design' : 'Readymade'}
          </span>
        </div>

        {/* Simple View Link */}
        <div className="flex justify-end">
          <Link
            to={`/${item.type === "design" ? "catalogue" : "products"}/${item._id}`}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            View Details →
          </Link>
        </div>
      </div>
    </div>
  );
};

// Main component
const HomepageFeatured = ({ 
  title, 
  subtitle, 
  emptyTitle, 
  emptyMessage,
  icon,
  items,
  loading,
  error,
  onRetry,
  viewAllLink
}) => {
  // Image normalization
  const getItemImages = (item) => {
    let imgs = Array.isArray(item.previewImages) ? item.previewImages.filter(Boolean) : [];

    if (!imgs.length) {
      if (item.previewImage) imgs = [item.previewImage];
      else if (item.imageUrl) imgs = [item.imageUrl];
    }

    return imgs
      .map((image) => getRawImagePath(image))
      .filter((image) => image && image.trim() !== "");
  };

  // Loading State
  if (loading) {
    return (
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-4 animate-pulse"></div>
            <div className="h-4 w-64 bg-gray-200 rounded mx-auto animate-pulse"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-pulse">
                <div className="h-64 bg-gray-200"></div>
                <div className="p-4">
                  <div className="h-5 bg-gray-200 rounded mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3 ml-auto"></div>
                </div>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={onRetry}
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{emptyTitle}</h2>
            <p className="text-gray-600">{emptyMessage}</p>
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
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-3">
            {icon}
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          </div>
          <p className="text-gray-600">
            {subtitle}
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => (
            <ProductCard 
              key={`${item.type}-${item._id}`} 
              item={item}
              getItemImages={getItemImages}
            />
          ))}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="mt-12 text-center">
            <div className="text-sm text-gray-500 mb-4">
              Showing {items.length} items
            </div>
            {viewAllLink && (
              <Link
                to={viewAllLink}
                className="inline-block text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                View All →
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default HomepageFeatured;
