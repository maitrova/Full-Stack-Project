import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Hero = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const slides = [
    {
      title: "CELEBRATE WITH SWAG",
      description: "Add your company logo to custom t-shirts and promo products.",
      buttonText: "Get Started",
      image: "https://img.freepik.com/free-photo/arrangement-black-friday-shopping-carts-with-copy-space_23-2148667047.jpg?semt=ais_hybrid&w=740&q=80"
    },
    {
      title: "PREMIUM QUALITY PRODUCTS",
      description: "High-quality custom merchandise that represents your brand perfectly.",
      buttonText: "Shop Now",
      image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
    }
  ];

  const nextSlide = useCallback(() => {
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    // Reset transition state after animation completes
    setTimeout(() => setIsTransitioning(false), 700);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    // Reset transition state after animation completes
    setTimeout(() => setIsTransitioning(false), 700);
  }, [slides.length]);

  // Auto-scroll effect
  useEffect(() => {
    if (isTransitioning) return; // Don't auto-scroll during manual transitions
    
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [nextSlide, isTransitioning]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isTransitioning) return;
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'ArrowRight') nextSlide();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevSlide, nextSlide, isTransitioning]);

  const goToSlide = (index) => {
    if (isTransitioning || index === currentSlide) return;
    setIsTransitioning(true);
    setCurrentSlide(index);
    setTimeout(() => setIsTransitioning(false), 700);
  };

  return (
    <section className="relative h-[400px] sm:h-[500px] md:h-[600px] lg:h-[700px] overflow-hidden">
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            index === currentSlide 
              ? 'opacity-100 z-10' 
              : 'opacity-0 z-0'
          }`}
          aria-hidden={index !== currentSlide}
        >
          {/* Background Image with Gradient Overlay */}
          <div className="absolute inset-0">
            <img
              src={slide.image}
              alt={`Slide ${index + 1}: ${slide.title}`}
              className="w-full h-full object-cover"
              loading={index === 0 ? 'eager' : 'lazy'}
            />
            {/* Gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent md:bg-gradient-to-r md:from-black/70 md:via-black/50 md:to-transparent" />
          </div>
          
          {/* Content Container */}
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
            <div className="text-white max-w-xl md:max-w-2xl relative z-10">
              {/* Title - Responsive sizing */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
                {slide.title}
              </h1>
              
              {/* Description - Responsive sizing */}
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-6 sm:mb-8 md:mb-10 text-gray-100">
                {slide.description}
              </p>
              
              {/* Button - Responsive sizing */}
              <button 
                className="
                  bg-white text-gray-900 
                  px-6 py-3 sm:px-8 sm:py-3 md:px-10 md:py-4 
                  rounded-lg font-semibold 
                  text-sm sm:text-base md:text-lg lg:text-xl 
                  hover:bg-gray-100 
                  active:scale-95
                  transition-all duration-200 
                  shadow-lg hover:shadow-xl
                  focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50
                "
                onClick={() => console.log(`Clicked: ${slide.buttonText}`)}
              >
                {slide.buttonText}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Navigation arrows - Responsive positioning and sizing */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between items-center px-3 sm:px-4 md:px-6 z-20">
        <button
          onClick={prevSlide}
          disabled={isTransitioning}
          className="
            bg-white/90 hover:bg-white 
            disabled:opacity-50 disabled:cursor-not-allowed
            text-gray-800 
            p-2 sm:p-3 
            rounded-full 
            shadow-lg hover:shadow-xl 
            transition-all duration-200 
            active:scale-95
            focus:outline-none focus:ring-2 focus:ring-white
          "
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
        </button>
        
        <button
          onClick={nextSlide}
          disabled={isTransitioning}
          className="
            bg-white/90 hover:bg-white 
            disabled:opacity-50 disabled:cursor-not-allowed
            text-gray-800 
            p-2 sm:p-3 
            rounded-full 
            shadow-lg hover:shadow-xl 
            transition-all duration-200 
            active:scale-95
            focus:outline-none focus:ring-2 focus:ring-white
          "
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
        </button>
      </div>

      {/* Slide indicators - Responsive positioning and sizing */}
      <div className="
        absolute 
        bottom-4 sm:bottom-6 md:bottom-8 
        left-1/2 transform -translate-x-1/2 
        flex space-x-2 sm:space-x-3 
        z-20
      ">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            disabled={isTransitioning}
            className={`
              w-3 h-3 sm:w-4 sm:h-4 
              rounded-full 
              transition-all duration-300 
              border-2 border-white 
              ${index === currentSlide 
                ? 'bg-white scale-125' 
                : 'bg-transparent hover:bg-white/50'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-white
            `}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 z-20 bg-white/20">
        <div 
          className="h-full bg-white transition-all duration-5000 ease-linear"
          style={{ 
            width: isTransitioning ? '100%' : '0%',
            transition: isTransitioning ? 'none' : 'width 5s linear'
          }}
          key={currentSlide} // Reset animation on slide change
        />
      </div>

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {currentSlide + 1} of {slides.length}: {slides[currentSlide].title}
      </div>
    </section>
  );
};

export default Hero;