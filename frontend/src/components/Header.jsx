import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout, selectCurrentUser, logoutUser } from '../redux/slices/Userslice.js'; // Adjust path as needed

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Redux hooks
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const isAuthenticated = !!user; // Check if user exists

  const handleSearch = (e) => {
    e.preventDefault();
    // Search logic here
    console.log('Searching for:', searchQuery);
  };

  const handleLogout = () => {
    // Dispatch the async logout thunk
    dispatch(logoutUser());
    // Alternatively, you can use the synchronous logout action:
    // dispatch(logout());
  };

  return (
    <header className="bg-white border-b border-gray-200 relative">
      {/* Top banner */}
      <div className="bg-gray-100 py-1 px-4 text-center text-sm">
        Custom T-shirts & Promotional Products, Fast & Free Shipping, and All-Inclusive Pricing
      </div>
      
      {/* Main header */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Logo */}
          <div className="flex items-center">
            <Link to="/" className="w-32 h-10 bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold rounded-lg shadow-md">
              Maitrova
            </Link>
          </div>

          {/* Center - Search bar */}
          <div className="flex-1 max-w-2xl mx-8">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search for t-shirts, hoodies, koozies, and more"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                type="submit"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                🔍
              </button>
            </form>
          </div>

          {/* Right side - User actions & Contact info */}
          <div className="flex items-center space-x-6">
            {/* User section */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                {isAuthenticated ? (
                  // Show user info and logout when logged in
                  <>
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="hidden md:block">
                        <div className="text-sm font-medium text-gray-700">
                          Hi, {user.name?.split(' ')[0] || 'User'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.role || 'Customer'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  // Show login/signup when not logged in
                  <>
                    <Link
                      to="/login"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm hidden md:block"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Contact info */}
            <div className="flex items-center space-x-6 border-l border-gray-200 pl-6">
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
      </div>
    </header>
  );
};

export default Header;