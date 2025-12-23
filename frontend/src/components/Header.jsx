import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout, selectCurrentUser, logoutUser } from '../redux/slices/Userslice.js';
import { 
  selectCartItemCount, 
  selectCart,
  getCart,
  selectCartLoading
} from '../redux/slices/Cartslice.js'; // Adjust path as needed

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Redux hooks
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const cartItemCount = useSelector(selectCartItemCount);
  const cart = useSelector(selectCart);
  const cartLoading = useSelector(selectCartLoading);
  const isAuthenticated = !!user; // Check if user exists

  // Fetch cart data when component mounts and user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(getCart());
    }
  }, [dispatch, isAuthenticated]);

  const handleSearch = (e) => {
    e.preventDefault();
    // Search logic here
    console.log('Searching for:', searchQuery);
  };

  const handleLogout = () => {
    // Dispatch the async logout thunk
    dispatch(logoutUser());
  };

  // Cart Icon Component
  const CartIcon = () => (
    <Link 
      to="/cart" 
      className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-6 w-6 text-gray-700"
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" 
        />
      </svg>
      {cartItemCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
          {cartItemCount > 9 ? '9+' : cartItemCount}
        </span>
      )}
    </Link>
  );

  // Cart Dropdown Component (for hover/click preview)
  const CartDropdown = () => (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">Shopping Cart</h3>
          <Link 
            to="/cart" 
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View Cart
          </Link>
        </div>
        
        {cartLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : cart?.items && cart.items.length > 0 ? (
          <>
            <div className="max-h-64 overflow-y-auto">
              {cart.items.slice(0, 3).map((item) => (
                <div key={item._id} className="flex items-center py-3 border-b border-gray-100 last:border-b-0">
                  <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.productName} 
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">IMG</span>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <h4 className="text-sm font-medium text-gray-800 truncate">
                      {item.productName}
                    </h4>
                    <p className="text-xs text-gray-500">Qty: {item.qty}</p>
                    <p className="text-sm font-semibold text-gray-900">
                      ₹{((item.unitPrice || 0) * (item.qty || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
              
              {cart.items.length > 3 && (
                <div className="text-center py-2 text-sm text-gray-500">
                  +{cart.items.length - 3} more items
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Subtotal:</span>
                <span className="font-semibold">
                  ₹{cart.cartSummary?.subtotal?.toFixed(2) || '0.00'}
                </span>
              </div>
              <Link 
                to="/checkout"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded-lg font-medium transition-colors"
              >
                Proceed to Checkout
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-12 w-12 mx-auto" 
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
            <p className="text-gray-500 mb-4">Your cart is empty</p>
            <Link 
              to="/products"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              Start Shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );

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

          {/* Right side - User actions, Cart & Contact info */}
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

            {/* Cart Button with Dropdown */}
            <div className="relative">
              <div 
                className="flex items-center"
                onMouseEnter={() => setShowDropdown(true)}
                onMouseLeave={() => setShowDropdown(false)}
              >
                <CartIcon />
                <div className="hidden md:block ml-1">
                  <div className="text-xs text-gray-500">Cart</div>
                  <div className="text-sm font-semibold">
                    {cartItemCount > 0 ? (
                      <>₹{cart?.cartSummary?.subtotal?.toFixed(2) || '0.00'}</>
                    ) : (
                      '₹0.00'
                    )}
                  </div>
                </div>
              </div>
              
              {/* Cart Dropdown on hover/click */}
              {showDropdown && <CartDropdown />}
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