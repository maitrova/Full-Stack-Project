import { useState, useEffect } from 'react';

const Hero = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <section className="relative h-[600px] overflow-hidden">
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
            index === currentSlide ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Background Image with Overlay */}
          <div className="absolute inset-0">
            <img
              src={slide.image}
              alt={`Slide ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0"></div>
          </div>
          
          {/* Content */}
          <div className="container mx-auto px-4 h-full flex items-center">
            <div className="text-white max-w-2xl relative z-10">
              <h1 className="text-6xl font-bold mb-6 leading-tight">{slide.title}</h1>
              <p className="text-2xl mb-10 text-gray-100">{slide.description}</p>
              <button className="bg-white text-blue-600 px-10 py-4 rounded-lg font-semibold text-xl hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 shadow-lg">
                {slide.buttonText}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Navigation arrows - More visible */}
      <button
        onClick={prevSlide}
        className="absolute left-6 top-1/2 transform -translate-y-1/2 bg-white text-gray-800 hover:bg-gray-100 p-4 rounded-full shadow-2xl transition-all duration-200 hover:scale-110 z-20"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <button
        onClick={nextSlide}
        className="absolute right-6 top-1/2 transform -translate-y-1/2 bg-white text-gray-800 hover:bg-gray-100 p-4 rounded-full shadow-2xl transition-all duration-200 hover:scale-110 z-20"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Slide indicators */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-3 z-20">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-4 h-4 rounded-full transition-all duration-200 border-2 border-white ${
              index === currentSlide ? 'bg-white' : 'bg-transparent'
            } hover:bg-white hover:bg-opacity-50`}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;