import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../redux/slices/Userslice.js';
import { 
  selectCartItemCount, 
  selectCart,
  getCart,
  selectCartLoading
} from '../redux/slices/Cartslice.js';

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredLink, setHoveredLink] = useState(null);
  
  // Social media URLs (configure these as needed)
  const socialMedia = {
    whatsapp: 'https://wa.me/919390319652',
    instagram: 'https://instagram.com/maitrova',
    facebook: 'https://facebook.com/maitrova',
    twitter: 'https://twitter.com/maitrova',
  };

  // Redux hooks
  const dispatch = useDispatch();
  const user = useSelector(state => state.user.userInfo);
  const cartItemCount = useSelector(selectCartItemCount);
  const cart = useSelector(selectCart);
  const cartLoading = useSelector(selectCartLoading);
  const isAuthenticated = !!user;

  // Fetch cart data when component mounts and user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(getCart());
    }
  }, [dispatch, isAuthenticated]);

  const handleLogout = () => {
    dispatch(logoutUser());
    setIsMobileMenuOpen(false);
  };

  // Professional hover effects
  const hoverEffects = {
    primary: "transition-all duration-300 hover:scale-105 hover:shadow-md",
    subtle: "transition-all duration-200 hover:opacity-90",
    glow: "transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20",
    lift: "transition-transform duration-300 hover:-translate-y-0.5",
    slide: "relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:bg-blue-600 after:transition-all after:duration-300 after:w-0 hover:after:w-full"
  };

  // Navigation items
  const navItems = [
    { path: "/allproducts", label: "Products", icon: "📦" },
    { path: "/customproducts", label: "Custom Design", icon: "🎨" },
    ...(isAuthenticated ? [
      // { path: "/usersaved_designs", label: "My Designs", icon: "✏️" }
    ] : [])
  ];

  // User menu items
  const userMenuItems = [
    { path: "/profile", label: "My Profile", icon: "👤" },
    { path: "/orders", label: "My Orders", icon: "📋" },
    { path: "/usersaved_designs", label: "My Designs", icon: "✏️" }
  ];

  // Social Media Icons Component
  const SocialMediaIcons = ({ variant = 'desktop', position = 'profile' }) => (
    <div className={`flex items-center space-x-1 ${position === 'profile' ? '' : variant === 'mobile' ? 'justify-center py-2' : ''}`}>
      <a 
        href={socialMedia.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className={`p-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white ${hoverEffects.lift} hover:shadow-lg hover:from-green-600 hover:to-green-700 group relative`}
        title="Chat with us on WhatsApp"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.67-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.76.982.999-3.675-.236-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.897 6.994c-.004 5.45-4.438 9.88-9.888 9.88m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.333.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.333 11.893-11.893 0-3.18-1.24-6.162-3.495-8.411"/>
        </svg>
        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          WhatsApp
        </span>
      </a>
      
      <a 
        href={socialMedia.instagram}
        target="_blank"
        rel="noopener noreferrer"
        className={`p-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white ${hoverEffects.lift} hover:shadow-lg hover:from-pink-600 hover:to-purple-700 group relative`}
        title="Follow us on Instagram"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          Instagram
        </span>
      </a>
      
      {/* Optional: Facebook icon - can be added if needed */}
      {position === 'profile' && (
        <a 
          href={socialMedia.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className={`p-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white ${hoverEffects.lift} hover:shadow-lg hover:from-blue-700 hover:to-blue-800 hidden lg:block group relative`}
          title="Like us on Facebook"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            Facebook
          </span>
        </a>
      )}
    </div>
  );

  // Cart Icon Component
  const CartIcon = () => (
    <Link 
      to="/cart" 
      className={`relative p-3 bg-white rounded-xl border border-gray-200 ${hoverEffects.glow} group`}
      onClick={() => setIsMobileMenuOpen(false)}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-6 w-6 text-gray-700 group-hover:text-blue-600 transition-colors"
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={1.8} 
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" 
        />
      </svg>
      {cartItemCount > 0 && (
        <span className={`absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg ${hoverEffects.lift}`}>
          {cartItemCount > 9 ? '9+' : cartItemCount}
        </span>
      )}
      {/* Animated ring on hover */}
      <div className="absolute inset-0 rounded-xl ring-2 ring-transparent group-hover:ring-blue-400/30 transition-all duration-500"></div>
    </Link>
  );

  // Cart Dropdown Component
  const CartDropdown = () => (
    <div className={`absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden transform transition-all duration-300 ${showDropdown ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-white text-lg">Shopping Cart</h3>
          <Link 
            to="/cart" 
            className="text-white/90 hover:text-white text-sm font-medium bg-white/10 px-3 py-1 rounded-lg transition-all duration-200 hover:bg-white/20"
            onClick={() => setShowDropdown(false)}
          >
            View Cart →
          </Link>
        </div>
      </div>
      
      <div className="p-4 max-h-96 overflow-y-auto">
        {cartLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-500">Loading your cart...</p>
          </div>
        ) : cart?.items && cart.items.length > 0 ? (
          <>
            <div className="space-y-3">
              {cart.items.slice(0, 3).map((item) => (
                <div key={item._id} className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 group">
                  <div className="relative w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden flex items-center justify-center shadow-sm">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.productName} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <span className="text-gray-400 text-sm">📦</span>
                    )}
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                      {item.productName}
                    </h4>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Qty: {item.qty}</span>
                        <span className="text-xs text-gray-500">×</span>
                        <span className="text-xs font-medium text-gray-700">₹{item.unitPrice?.toFixed(2)}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        ₹{((item.unitPrice || 0) * (item.qty || 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {cart.items.length > 3 && (
                <div className="text-center py-2">
                  <div className="inline-flex items-center px-4 py-2 bg-blue-50 rounded-full text-blue-600 text-sm font-medium">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                    </svg>
                    +{cart.items.length - 3} more items
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-600">Subtotal:</span>
                <span className="text-lg font-bold text-gray-900">
                  ₹{cart.cartSummary?.subtotal?.toFixed(2) || '0.00'}
                </span>
              </div>
              <Link 
                to="/checkout"
                className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-center py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
                onClick={() => setShowDropdown(false)}
              >
                Proceed to Checkout
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-4">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-10 w-10 text-gray-400"
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1} 
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" 
                />
              </svg>
            </div>
            <p className="text-gray-600 mb-6">Your cart is empty</p>
            <Link 
              to="/products"
              className="inline-block bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
              onClick={() => setShowDropdown(false)}
            >
              Start Shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  // User Profile Component (with social media integrated)
  const UserProfile = () => (
    <div className="flex items-center space-x-3">
      {/* Social media icons on left (for authenticated users) */}
      {isAuthenticated && (
        <div className="hidden lg:flex items-center space-x-2 mr-2">
          <SocialMediaIcons position="profile" />
          <div className="h-6 w-px bg-gray-300"></div>
        </div>
      )}
      
      {/* User profile card */}
      <Link to="/profile">
      <div className="flex items-center space-x-3 p-2 pr-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 group hover:border-blue-300 transition-all duration-300">
        <div className="relative">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-md group-hover:scale-110 transition-transform duration-300">
            {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
        </div>
        <div className="hidden lg:block">
          <div className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
            {user?.name?.split(' ')[0] || 'User'}
          </div>
          
        </div>
      </div>
      </Link>
    </div>
  );

  // Simplified top banner without social media
  const TopBanner = () => (
    <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 py-2 px-4">
      <div className="container mx-auto">
        <div className="text-center text-sm">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span className="flex items-center text-blue-600 whitespace-nowrap">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              Free Shipping Nationwide
            </span>
            <span className="text-gray-400 hidden sm:inline">•</span>
            <span className="text-purple-600 whitespace-nowrap">Custom Designs in 48 Hours</span>
            <span className="text-gray-400 hidden lg:inline">•</span>
            <span className="text-pink-600 whitespace-nowrap hidden lg:inline">Premium Quality Guaranteed</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-50 shadow-sm">
      {/* Top banner */}
      <TopBanner />
      
      {/* Main header */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Logo & Mobile Menu */}
          <div className="flex items-center space-x-6">
            {/* Mobile Menu Button */}
            <button
              className={`md:hidden p-3 rounded-xl border border-gray-200 ${hoverEffects.glow}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 text-gray-700"
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            
            {/* Logo */}
            <Link to="/" className={`relative ${hoverEffects.lift}`}>
              <div className="relative overflow-hidden">
                <div className="w-40 h-12 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-xl rounded-xl shadow-lg hover:shadow-xl transition-all duration-500">
                  <span className="relative z-10">MAITROVA</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                </div>
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"></div>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-1 flex-1 justify-center">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-6 py-3 rounded-xl font-medium text-gray-700 ${hoverEffects.slide} hover:text-blue-600 group`}
                onMouseEnter={() => setHoveredLink(item.path)}
                onMouseLeave={() => setHoveredLink(null)}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {hoveredLink === item.path && (
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-50/30 to-purple-50/30 rounded-xl -z-10"></div>
                )}
              </Link>
            ))}
          </div>

          {/* Right side - User actions & Cart */}
          <div className="flex items-center space-x-3">
            {/* Desktop User Actions */}
            <div className="hidden md:flex items-center space-x-3">
              {isAuthenticated ? (
                <>
                  {/* Quick Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {userMenuItems.slice(1).map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`px-4 py-2.5 rounded-lg font-medium text-gray-700 bg-gray-50 border border-gray-200 ${hoverEffects.lift} hover:bg-white hover:border-blue-300 hover:shadow-md group`}
                      >
                        <div className="flex items-center space-x-2">
                          <span>{item.icon}</span>
                          <span className="text-sm">{item.label}</span>
                        </div>
                      </Link>
                    ))}
                    <button
                      onClick={handleLogout}
                      className={`px-4 py-2.5 rounded-lg font-medium text-red-600 bg-red-50 border border-red-200 ${hoverEffects.lift} hover:bg-red-100 hover:border-red-300 hover:shadow-md`}
                    >
                      <div className="flex items-center space-x-2">
                        <span>🚪</span>
                        <span className="text-sm">Logout</span>
                      </div>
                    </button>
                  </div>
                  
                  {/* User Profile with Social Media */}
                  <div className="relative group">
                    <UserProfile />
                  </div>
                </>
              ) : (
                <>
                  {/* Social Media for non-authenticated users */}
                  <SocialMediaIcons position="auth" />
                  <div className="h-6 w-px bg-gray-300"></div>
                  
                  <div className="flex items-center space-x-3">
                    <Link
                      to="/login"
                      className={`px-5 py-2.5 rounded-lg font-medium text-gray-700 bg-gray-50 border border-gray-200 ${hoverEffects.lift} hover:bg-white hover:border-blue-300 hover:shadow-md`}
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className={`px-5 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 ${hoverEffects.lift} hover:from-blue-600 hover:to-purple-600 hover:shadow-md`}
                    >
                      Get Started
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Social Media Icons (for non-authenticated users) */}
            {!isAuthenticated && (
              <div className="md:hidden flex items-center space-x-2">
                <SocialMediaIcons variant="mobile" />
              </div>
            )}

            {/* Cart Button with Dropdown */}
            <div className="relative">
              <div 
                className="flex items-center"
                onMouseEnter={() => window.innerWidth > 768 && setShowDropdown(true)}
                onMouseLeave={() => window.innerWidth > 768 && setShowDropdown(false)}
              >
                <CartIcon />
                <div className="hidden md:block ml-2">
                  <div className="text-xs text-gray-500 font-medium">TOTAL</div>
                  <div className="text-sm font-bold text-gray-900">
                    {cartItemCount > 0 ? (
                      <>₹{cart?.cartSummary?.subtotal?.toFixed(2) || '0.00'}</>
                    ) : (
                      '₹0.00'
                    )}
                  </div>
                </div>
              </div>
              
              {/* Cart Dropdown - desktop only */}
              {showDropdown && window.innerWidth > 768 && <CartDropdown />}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-200 absolute top-full left-0 right-0 shadow-xl z-40 animate-slideDown">
          <div className="px-4 py-4 space-y-2">
            {isAuthenticated && (
              <>
                <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800 truncate">
                      {user?.name || 'User'}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {user?.email || ''}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 p-2">
                  {userMenuItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex flex-col items-center justify-center p-3 bg-gray-50 rounded-xl border border-gray-200 ${hoverEffects.lift} hover:bg-white hover:border-blue-300`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span className="text-2xl mb-1">{item.icon}</span>
                      <span className="text-xs font-medium text-gray-700 text-center">{item.label}</span>
                    </Link>
                  ))}
                  <button
                    onClick={handleLogout}
                    className={`flex flex-col items-center justify-center p-3 bg-red-50 rounded-xl border border-red-200 ${hoverEffects.lift} hover:bg-red-100 hover:border-red-300`}
                  >
                    <span className="text-2xl mb-1">🚪</span>
                    <span className="text-xs font-medium text-red-600 text-center">Logout</span>
                  </button>
                </div>
              </>
            )}
            
            <div className="pt-2 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-center p-3 bg-gray-50 rounded-xl border border-gray-200 ${hoverEffects.lift} hover:bg-white hover:border-blue-300`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="text-lg mr-2">{item.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  </Link>
                ))}
              </div>
              
              {/* Social Media in mobile menu */}
              <div className="mt-4 flex justify-center">
                <SocialMediaIcons variant="mobile" position="mobile-menu" />
              </div>
              
              {!isAuthenticated && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Link
                    to="/login"
                    className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-center font-medium text-gray-700 hover:bg-white hover:border-blue-300 transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl border border-transparent text-center font-medium text-white hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;