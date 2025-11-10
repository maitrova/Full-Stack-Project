const ProductCategories = () => {
  const categories = [
    { name: "T-shirts", icon: "👕" },
    { name: "Sweatshirts", icon: "🧥" },
    { name: "Hats", icon: "🧢" },
    { name: "Jackets & Vests", icon: "🦺" }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Custom T-shirts & Promotional Products for Your Group
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover our wide range of customizable products perfect for your team, event, or organization
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {categories.map((category, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group cursor-pointer"
            >
              <div className="p-8 text-center">
                {/* Icon */}
                <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  {category.icon}
                </div>
                
                {/* Category Name */}
                <h3 className="text-2xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">
                  {category.name}
                </h3>
                
                {/* Hover Arrow */}
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <svg 
                    className="w-6 h-6 text-blue-600 mx-auto" 
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
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Optional: View All Button */}
        <div className="text-center mt-12">
          <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl">
            View All Products
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProductCategories;