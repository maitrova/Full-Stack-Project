const Header = () => {
  return (
    <header className="bg-white border-b border-gray-200">
      {/* Top banner */}
      <div className="bg-gray-100 py-1 px-4 text-center text-sm">
        Custom T-shirts & Promotional Products, Fast & Free Shipping, and All-Inclusive Pricing
      </div>
      
      {/* Main header */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Logo placeholder */}
          <div className="flex items-center">
            <div className="w-32 h-10 bg-gray-300 flex items-center justify-center text-gray-600 font-bold">
              Maitrova
            </div>
          </div>

          {/* Center - Search bar */}
          <div className="flex-1 max-w-2xl mx-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for t-shirts, hoodies, koozies, and more"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <span className="text-gray-400">Q</span>
              </div>
            </div>
          </div>

          {/* Right side - Contact info */}
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <div className="text-sm text-gray-600">Talk to a Real Person</div>
              <div className="font-semibold text-blue-600">Chat with a Real Person</div>
            </div>
            <div className="flex flex-col items-end">
              <a href="tel:844-222-8343" className="text-lg font-bold text-gray-900 hover:text-blue-600">
                (844) 222-8343
              </a>
              <button className="text-blue-600 font-semibold hover:text-blue-800 text-sm mt-1">
                Chat Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;