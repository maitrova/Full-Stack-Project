const Footer = () => {
  return (
    <footer className="bg-neutral-50 text-gray-700 border-t border-gray-100">
      {/* Main Footer Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          
          {/* Brand & Contact Column */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 tracking-tight">CONTACT US</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Customer Support</p>
                  <a href="tel:844-222-8343" className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                    844-222-8343
                  </a>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Monday-Friday: 8am - Midnight ET</p>
                  <p>Weekends: 10am - 6pm ET</p>
                </div>
              </div>
            </div>

            {/* Email Sign-up */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 tracking-tight">STAY UPDATED</h3>
              <div className="space-y-3">
                <div className="flex">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-l-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                  />
                  <button className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-r-lg font-medium transition-colors">
                    Subscribe
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Subscribe for updates. Read our <a href="#" className="text-gray-700 hover:text-blue-600 underline">Privacy Policy</a>.
                </p>
              </div>
            </div>
          </div>

          {/* Resources Column */}
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 tracking-tight">RESOURCES</h3>
              <ul className="space-y-2.5">
                {[
                  "Help Center",
                  "Design Guidelines",
                  "Blog & Inspiration",
                  "Weekly Photo Contest",
                  "Store Locations",
                  "Customer Reviews"
                ].map((item) => (
                  <li key={item}>
                    <a 
                      href="#" 
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors hover:underline"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 tracking-tight">YOUR ACCOUNT</h3>
              <ul className="space-y-2.5">
                {[
                  "Retrieve Saved Design",
                  "Track Order",
                  "Print Proof",
                  "Reorder",
                  "Account Settings"
                ].map((item) => (
                  <li key={item}>
                    <a 
                      href="#" 
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors hover:underline"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Company Column */}
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 tracking-tight">COMPANY</h3>
              <ul className="space-y-2.5">
                {[
                  "About Us",
                  "Careers",
                  "Press",
                  "Partnerships",
                  "Diversity & Inclusion",
                  "Accessibility"
                ].map((item) => (
                  <li key={item}>
                    <a 
                      href="#" 
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors hover:underline"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 tracking-tight">CONNECT</h3>
              <div className="flex space-x-3">
                {[
                  { name: 'Facebook', icon: (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  )},
                  { name: 'Instagram', icon: (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  )},
                  { name: 'Twitter', icon: (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.213c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  )},
                  { name: 'YouTube', icon: (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  )}
                ].map((platform) => (
                  <a
                    key={platform.name}
                    href="#"
                    className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 text-gray-600 hover:text-gray-900"
                    aria-label={platform.name}
                  >
                    {platform.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions Column */}
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 tracking-tight">QUICK ACTIONS</h3>
              <div className="space-y-3">
                <button className="w-full bg-white border border-gray-300 hover:border-gray-400 text-gray-800 py-3 rounded-lg font-medium transition-all hover:shadow-sm text-sm">
                  Live Chat Support
                </button>
                <button className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-lg font-medium transition-colors text-sm">
                  Start New Design
                </button>
                <button className="w-full bg-white border border-gray-300 hover:border-gray-400 text-gray-800 py-3 rounded-lg font-medium transition-all hover:shadow-sm text-sm">
                  Share Feedback
                </button>
              </div>
            </div>

            {/* App Download */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 tracking-tight">MOBILE APP</h3>
              <div className="space-y-3">
                <button className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 text-sm">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  <span>Download on App Store</span>
                </button>
                <button className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 text-sm">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35l13.5 9.5-13.5 9.5c-.5-.24-.84-.76-.84-1.35zM15 12l-13.5-9.5c.18-.09.37-.16.57-.19l13.43 9.69zm-13.5 9.5l13.43-9.69c.2.03.39.1.57.19l-13.5 9.5c-.2.09-.4.16-.6.19l.1-.19z"/>
                  </svg>
                  <span>Get it on Google Play</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-200 bg-white">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-gray-500 text-sm">
              © 2024 MyPrint. All rights reserved.
            </div>
            <div className="flex space-x-6 text-sm">
              <a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Privacy</a>
              <a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Terms</a>
              <a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Cookies</a>
              <a href="#" className="text-gray-500 hover:text-gray-900 transition-colors">Accessibility</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;