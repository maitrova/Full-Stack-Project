const NewArrivalsWithImage = () => {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Text Content */}
              <div className="p-12 flex flex-col justify-center">
                <div className="mb-6">
                  <span className="inline-block bg-blue-100 text-blue-600 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                    New Collection
                  </span>
                  <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                    New Arrivals Are Here
                  </h2>
                  <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                    Gear up for the season with fresh picks from the brands you love. From cozy layers to cool accessories, we're always adding more!
                  </p>
                </div>
                
                <button className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center group w-fit">
                  Shop Now
                  <svg 
                    className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M14 5l7 7m0 0l-7 7m7-7H3" 
                    />
                  </svg>
                </button>
              </div>

              {/* Image Section */}
              <div className="relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
                  alt="New Arrivals Collection"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                
                {/* Badge on image */}
                <div className="absolute top-6 right-6 bg-white text-blue-600 px-4 py-2 rounded-full font-semibold text-sm shadow-lg">
                  Just Launched
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewArrivalsWithImage;