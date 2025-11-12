import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { logoutUser, selectCurrentUser, selectAuthStatus } from '../redux/slices/Userslice.js';

const Header = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const authStatus = useSelector(selectAuthStatus);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      setShowDropdown(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleProfileClick = () => {
    setShowDropdown(!showDropdown);
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
            <div className="relative">
              <input
                type="text"
                placeholder="Search for t-shirts, hoodies, koozies, and more"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <span className="text-gray-400">🔍</span>
              </div>
            </div>
          </div>

          {/* Right side - User actions & Contact info */}
          <div className="flex items-center space-x-6">
            {/* User section */}
            <div className="flex items-center space-x-4">
              {user ? (
                // Logged in state
                <div className="relative">
                  <button
                    onClick={handleProfileClick}
                    className="flex items-center space-x-2 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium text-gray-700 hidden md:block">
                      {user.name || 'User'}
                    </span>
                    <svg 
                      className={`w-4 h-4 text-gray-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email || user.phone}</p>
                      </div>
                      
                      <Link
                        to="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        👤 My Profile
                      </Link>
                      
                      <Link
                        to="/orders"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        📦 My Orders
                      </Link>
                      
                      {user.role === 'admin' && (
                        <Link
                          to="/admin"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setShowDropdown(false)}
                        >
                          ⚙️ Admin Panel
                        </Link>
                      )}
                      
                      <div className="border-t border-gray-100 my-1"></div>
                      
                      <button
                        onClick={handleLogout}
                        disabled={authStatus === 'loading'}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center space-x-2"
                      >
                        {authStatus === 'loading' ? (
                          <>
                            <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            <span>Logging out...</span>
                          </>
                        ) : (
                          <>
                            <span>🚪</span>
                            <span>Logout</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // Not logged in state
                <div className="flex items-center space-x-3">
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
                </div>
              )}
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

      {/* Close dropdown when clicking outside */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </header>
  );
};

export default Header;