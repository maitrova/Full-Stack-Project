const Footer = () => {
  return (
    <footer className="bg-white text-gray-800 border-t border-gray-200">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Left Column - Brand & Social */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Watch Commercial & Email Signup */}
              <div>
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">WATCH OUR TV COMMERCIAL</h3>
                  <div className="bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 relative group">
                    <img 
                      src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1074&q=80" 
                      alt="Custom Ink TV Commercial"
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                      <div className="text-center text-white">
                        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform duration-300">
                          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                        <span className="font-semibold text-lg">Play Video</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email Sign-up */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">EMAIL SIGN-UP</h3>
                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="your email address"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors">
                      Submit
                    </button>
                    <p className="text-xs text-gray-600">
                      By clicking submit, I acknowledge I have read and accepted the Privacy Policy.
                    </p>
                  </div>
                </div>
              </div>

              {/* Social & Feedback */}
              <div>
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">FOLLOW US</h3>
                  <div className="flex space-x-4">
                    {[
                      { name: 'Facebook', icon: '📘', color: 'hover:bg-blue-100' },
                      { name: 'Twitter', icon: '🐦', color: 'hover:bg-blue-100' },
                      { name: 'Instagram', icon: '📷', color: 'hover:bg-pink-100' },
                      { name: 'YouTube', icon: '📺', color: 'hover:bg-red-100' }
                    ].map((platform) => (
                      <button
                        key={platform.name}
                        className={`w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center hover:scale-110 transition-all duration-200 ${platform.color}`}
                      >
                        <span className="text-lg">{platform.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">TELL US WHAT YOU THINK</h3>
                  <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-semibold transition-colors border border-gray-300 hover:border-gray-400">
                    Share Feedback
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - About & Account */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-8 lg:gap-0">
            
            {/* About Us */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">ABOUT US</h3>
              <ul className="space-y-2 text-gray-600">
                {[
                  "Get to Know Custom Ink",
                  "Careers",
                  "Press",
                  "Partnerships",
                  "Diversity & Belonging",
                  "Customer Reviews",
                  "Weekly Photo Contest",
                  "Custom Ink Blog",
                  "Store Locations"
                ].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-blue-600 transition-colors text-sm">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Your Account */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">YOUR ACCOUNT</h3>
              <ul className="space-y-2 text-gray-600">
                {[
                  "Retrieve a Saved Design",
                  "Retrieve a Printed Proof",
                  "Track Your Order",
                  "Place a Reorder"
                ].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-blue-600 transition-colors text-sm">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column - Contact & Service */}
          <div>
            
            {/* Contact Info */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">TALK TO A REAL PERSON</h3>
              <p className="text-gray-600 text-sm mb-4 font-medium">7 DAYS A WEEK</p>
              <div className="text-gray-600 text-sm space-y-1 mb-6">
                <p>Monday-Friday: 8am - Midnight ET</p>
                <p>Saturday: 10am - 6pm ET</p>
                <p>Sunday: 10am - 6pm ET</p>
              </div>
              
              <div className="space-y-3">
                <a href="tel:844-222-8343" className="block text-xl font-bold text-blue-600 hover:text-blue-800 transition-colors">
                  📞 844-222-8343
                </a>
                <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-colors">
                  Live Chat Now
                </button>
                <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold transition-colors border border-gray-300">
                  Send us an Email
                </button>
              </div>
            </div>

            {/* Service Center */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">SERVICE CENTER</h3>
              <ul className="space-y-2 text-gray-600">
                {[
                  "Help Center",
                  "Get a Quick Quote",
                  "Content Guidelines",
                  "Our Commitment to Accessibility"
                ].map((item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-blue-600 transition-colors text-sm">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-300 bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-600 text-sm">
              © 2024 Custom Ink. All rights reserved.
            </div>
            <div className="flex space-x-6 text-sm text-gray-600">
              <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-blue-600 transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;