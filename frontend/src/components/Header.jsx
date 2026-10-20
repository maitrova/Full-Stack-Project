import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser, selectCurrentToken } from '../redux/slices/Userslice.js';
import {
  fetchCommonSavedData,
  selectCommonSavedData,
} from '../redux/slices/commonproducts.js';
import {
  getCart,
  selectCart,
  selectCartItemCount,
  selectCartSummary,
  selectCartLoading,
} from '../redux/slices/Cartslice.js';
import { trackSearch } from '../utils/analytics.js';
import { Clock, Menu, Search, ShoppingBag, Trash2, User, X } from 'lucide-react';
import { Button, Wordmark, cx } from './ui/index.js';

const API_URL = import.meta.env.VITE_API_URL || 'https://maitrova.in/backend/api';
const DEFAULT_BANNER_MESSAGES = [
  'Free Shipping Nationwide',
  'Custom Designs in 48 Hours',
  'Premium Quality Guaranteed',
];
const RECENT_SEARCHES_KEY = 'maitrova_recent_searches';
const MAX_RECENT_SEARCHES = 6;

const socialLinks = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    href: 'https://wa.me/919390319652',
    icon: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.67-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.76.982.999-3.675-.236-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.897 6.994c-.004 5.45-4.438 9.88-9.888 9.88" />
      </svg>
    ),
  },
  {
    key: 'instagram',
    label: 'Instagram',
    href: 'https://instagram.com/maitrova',
    icon: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 3.675A6.163 6.163 0 1012 18a6.163 6.163 0 000-12.325zm0 10.162A4 4 0 1112 8a4 4 0 010 8zm6.406-11.845a1.44 1.44 0 101.441 1.44 1.441 1.441 0 00-1.441-1.44z" />
      </svg>
    ),
  },
  {
    key: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/share/1L82BUXkL1/?mibextid=wwXIfr',
    icon: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
];

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/customproducts', label: 'Customization' },
  { path: '/products', label: 'Products' },
  { path: '/combo-packs', label: 'Combo Packs' },
];

const userMenuItems = [
  { path: '/profile', label: 'My Profile' },
  { path: '/orders', label: 'My Orders' },
  { path: '/usersaved_designs', label: 'My Designs' },
];

const formatCurrency = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const getCartItemImage = (item) =>
  item?.previewImage ||
  item?.image ||
  item?.readymadeProduct?.thumbnail ||
  item?.readymadeProduct?.images?.[0]?.url ||
  item?.dropproduct?.images?.[0] ||
  item?.dropproduct?.thumbnail ||
  item?.product?.thumbnail ||
  item?.product?.images?.[0]?.url ||
  null;

const getCartItemTitle = (item) =>
  item?.productName ||
  item?.title ||
  item?.design?.title ||
  item?.design?.name ||
  item?.readymadeProduct?.title ||
  item?.readymadeProduct?.name ||
  item?.dropproduct?.title ||
  item?.dropproduct?.name ||
  item?.product?.title ||
  item?.product?.name ||
  'Product';

const SocialMediaIcons = ({ mobile = false }) => (
  <div className={`flex items-center ${mobile ? 'flex-wrap gap-2' : 'gap-1'}`}>
    {socialLinks.map((item) => (
      <a
        key={item.key}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        title={item.label}
        aria-label={item.label}
        className={
          mobile
            ? 'inline-flex h-11 items-center gap-2 rounded-mt-btn border border-mt-line px-3 text-sm text-mt-muted transition-colors hover:border-mt-line-strong hover:text-mt-text'
            : 'inline-flex h-9 w-9 items-center justify-center rounded-full text-mt-subtle transition-colors hover:bg-mt-tint/10 hover:text-mt-text'
        }
      >
        {item.icon}
        {mobile && <span>{item.label}</span>}
      </a>
    ))}
  </div>
);

const iconButtonClasses =
  'relative inline-flex h-11 w-11 items-center justify-center rounded-full text-mt-text transition-colors hover:bg-mt-tint/10 focus-visible:outline-2 focus-visible:outline-mt-text';

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [bannerMessages, setBannerMessages] = useState(DEFAULT_BANNER_MESSAGES);
  const [bannerCouponCode, setBannerCouponCode] = useState('');
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.userInfo);
  const token = useSelector(selectCurrentToken);
  const cartItemCount = useSelector(selectCartItemCount);
  const cart = useSelector(selectCart);
  const cartSummary = useSelector(selectCartSummary);
  const cartLoading = useSelector(selectCartLoading);
  const commonSavedData = useSelector(selectCommonSavedData);
  const isAuthenticated = !!token;

  useEffect(() => {
    dispatch(getCart());
  }, [dispatch, token]);

  useEffect(() => {
    if (!Array.isArray(commonSavedData) || commonSavedData.length === 0) {
      dispatch(fetchCommonSavedData({ page: 1 }));
    }
  }, [commonSavedData, dispatch]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
      setRecentSearches(Array.isArray(stored) ? stored.filter(Boolean).slice(0, MAX_RECENT_SEARCHES) : []);
    } catch (error) {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadBanner = async () => {
      try {
        const res = await fetch(`${API_URL}/header-banner`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Failed to load banner');
        }

        if (!isMounted) return;

        const nextMessages = Array.isArray(data?.messages)
          ? data.messages.map((message) => String(message || '').trim()).filter(Boolean)
          : DEFAULT_BANNER_MESSAGES;

        setBannerMessages(nextMessages);
        setBannerCouponCode(String(data?.couponCode || '').trim());
      } catch (error) {
        if (!isMounted) return;
        setBannerMessages(DEFAULT_BANNER_MESSAGES);
        setBannerCouponCode('');
      }
    };

    loadBanner();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsMobileSearchOpen(false);
    setIsSearchFocused(false);
    setShowDropdown(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
        setIsMobileSearchOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;
      const clickedDesktopSearch = desktopSearchRef.current?.contains(target);
      const clickedMobileSearch = mobileSearchRef.current?.contains(target);
      if (!clickedDesktopSearch && !clickedMobileSearch) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const cartSubtotal = useMemo(() => Number(cartSummary?.subtotal || 0), [cartSummary?.subtotal]);
  const visibleBannerMessages = useMemo(
    () => bannerMessages.map((message) => String(message || '').trim()).filter(Boolean),
    [bannerMessages]
  );
  const visibleBannerCoupon = useMemo(() => String(bannerCouponCode || '').trim(), [bannerCouponCode]);
  const bannerItems = useMemo(() => {
    const items = visibleBannerMessages.map((message, index) => ({
      key: `message-${index}`,
      type: 'message',
      label: message,
    }));

    if (visibleBannerCoupon) {
      items.push({
        key: 'coupon',
        type: 'coupon',
        label: `Coupon: ${visibleBannerCoupon}`,
      });
    }

    return items;
  }, [visibleBannerMessages, visibleBannerCoupon]);
  const marqueeBannerItems = useMemo(
    () => [...bannerItems, ...bannerItems],
    [bannerItems]
  );
  const searchSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || !Array.isArray(commonSavedData)) return [];

    const suggestions = new Map();
    const addSuggestion = (value, meta = 'Product') => {
      const label = String(value || '').trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (!key.includes(query) || suggestions.has(key)) return;
      suggestions.set(key, { label, meta });
    };

    commonSavedData.forEach((item) => {
      addSuggestion(item.title || item.name || item.productName, item.type === 'design' ? 'Design' : 'Product');
      addSuggestion(item.category, 'Category');
      addSuggestion(item.subCategory, 'Subcategory');
    });

    return Array.from(suggestions.values()).slice(0, 8);
  }, [commonSavedData, searchQuery]);
  const shouldShowSearchDropdown =
    isSearchFocused &&
    (searchSuggestions.length > 0 || (!searchQuery.trim() && recentSearches.length > 0));

  const isRouteActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleLogout = () => {
    dispatch(logoutUser());
    setIsMobileMenuOpen(false);
  };

  const persistRecentSearches = (items) => {
    setRecentSearches(items);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items));
    } catch (error) {
      // Recent searches are a progressive enhancement.
    }
  };

  const addRecentSearch = (term) => {
    const searchTerm = term.trim();
    if (!searchTerm) return;

    const nextSearches = [
      searchTerm,
      ...recentSearches.filter((item) => item.toLowerCase() !== searchTerm.toLowerCase()),
    ].slice(0, MAX_RECENT_SEARCHES);

    persistRecentSearches(nextSearches);
  };

  const deleteRecentSearch = (term) => {
    persistRecentSearches(
      recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase())
    );
  };

  const runSearch = (term) => {
    const searchTerm = term.trim();
    if (!searchTerm) {
      navigate('/products');
    } else {
      trackSearch({ searchTerm, source: 'header' });
      addRecentSearch(searchTerm);
      navigate(`/products?${new URLSearchParams({ search: searchTerm }).toString()}`);
    }
    setSearchQuery(searchTerm);
    setIsMobileSearchOpen(false);
    setIsSearchFocused(false);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    runSearch(searchQuery);
  };

  const renderSearchBox = ({ mobile = false } = {}) => (
    <div
      ref={mobile ? mobileSearchRef : desktopSearchRef}
      className={mobile ? 'relative w-full' : 'relative w-56 xl:w-72'}
    >
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        className={`flex items-center gap-2 rounded-mt-btn border border-mt-line bg-mt-surface transition-colors focus-within:border-mt-text ${
          mobile ? 'h-12 pl-3 pr-1.5' : 'h-10 px-3'
        }`}
      >
        <Search className="h-4 w-4 shrink-0 text-mt-subtle" aria-hidden="true" />
        <input
          type="text"
          inputMode="search"
          value={searchQuery}
          onFocus={() => setIsSearchFocused(true)}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setIsSearchFocused(true);
          }}
          placeholder="Search products"
          className="min-w-0 flex-1 bg-transparent text-sm text-mt-text outline-none placeholder:text-mt-subtle"
          aria-label="Search products"
          autoFocus={mobile}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setIsSearchFocused(true);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-mt-subtle transition-colors hover:bg-mt-tint/10 hover:text-mt-text"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {mobile && (
          <Button type="submit" size="sm" className="h-9 px-4">
            Go
          </Button>
        )}
      </form>

      {shouldShowSearchDropdown && (
        <div
          className={`absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-mt-card border border-mt-line bg-mt-surface shadow-2xl shadow-mt-tint/10 ${
            mobile ? '' : 'min-w-80'
          }`}
        >
          {searchQuery.trim() ? (
            <div className="p-1.5">
              <p className="px-3 pb-1.5 pt-2 text-[11px] uppercase tracking-[0.2em] text-mt-subtle">
                Suggestions
              </p>
              {searchSuggestions.map((item) => (
                <button
                  key={`${item.meta}-${item.label}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => runSearch(item.label)}
                  className="flex w-full items-center gap-3 rounded-mt-btn px-3 py-2.5 text-left transition-colors hover:bg-mt-tint/5"
                >
                  <Search className="h-4 w-4 shrink-0 text-mt-subtle" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-mt-text">{item.label}</span>
                    <span className="block text-xs text-mt-subtle">{item.meta}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-1.5">
              <p className="px-3 pb-1.5 pt-2 text-[11px] uppercase tracking-[0.2em] text-mt-subtle">
                Recent searches
              </p>
              {recentSearches.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-1 rounded-mt-btn pl-3 transition-colors hover:bg-mt-tint/5"
                >
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runSearch(item)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
                  >
                    <Clock className="h-4 w-4 shrink-0 text-mt-subtle" aria-hidden="true" />
                    <span className="truncate text-sm text-mt-text">{item}</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => deleteRecentSearch(item)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-mt-subtle transition-colors hover:bg-mt-tint/10 hover:text-mt-danger"
                    aria-label={`Delete ${item} from recent searches`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const CartIcon = () => (
    <Link
      to="/cart"
      className={iconButtonClasses}
      aria-label={cartItemCount > 0 ? `Cart, ${cartItemCount} items` : 'Cart'}
      onClick={() => setIsMobileMenuOpen(false)}
    >
      <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={1.6} aria-hidden="true" />
      {cartItemCount > 0 && (
        <span className="absolute right-1 top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-mt-btn px-1 text-[10px] font-semibold text-mt-btn-text">
          {cartItemCount > 9 ? '9+' : cartItemCount}
        </span>
      )}
    </Link>
  );

  const CartDropdown = () => (
    <div className="absolute right-0 top-full z-50 w-80 pt-2">
      <div className="overflow-hidden rounded-mt-card border border-mt-line bg-mt-surface shadow-2xl shadow-mt-tint/10">
        <div className="flex items-center justify-between border-b border-mt-line px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-mt-subtle">Shopping cart</p>
            <h3 className="mt-1 text-sm font-medium text-mt-text">
              {cartItemCount ? `${cartItemCount} item${cartItemCount > 1 ? 's' : ''}` : 'No items yet'}
            </h3>
          </div>
          <Link
            to="/cart"
            className="text-xs text-mt-muted transition-colors hover:text-mt-text"
            onClick={() => setShowDropdown(false)}
          >
            Open cart
          </Link>
        </div>

        <div className="max-h-96 overflow-y-auto p-4">
          {cartLoading ? (
            <div className="py-8 text-center text-sm text-mt-muted">Loading cart...</div>
          ) : cart?.items?.length ? (
            <div className="space-y-3">
              {cart.items.slice(0, 3).map((item) => {
                const imageSrc = getCartItemImage(item);
                const itemTitle = getCartItemTitle(item);

                return (
                  <div key={item._id} className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-mt-btn bg-mt-surface-raised">
                      {imageSrc ? (
                        <img src={imageSrc} alt={itemTitle} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-mt-subtle">Item</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-mt-text">{itemTitle}</p>
                      <p className="mt-1 text-xs text-mt-subtle">
                        Qty {item.qty} | {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <div className="text-sm text-mt-text">
                      {formatCurrency((item.unitPrice || 0) * (item.qty || 0))}
                    </div>
                  </div>
                );
              })}

              {cart.items.length > 3 && (
                <p className="text-center text-xs text-mt-subtle">+{cart.items.length - 3} more items</p>
              )}

              <div className="border-t border-mt-line pt-4">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-mt-muted">Subtotal</span>
                  <span className="font-medium text-mt-text">{formatCurrency(cartSubtotal)}</span>
                </div>
                <Button to="/checkout" fullWidth arrow onClick={() => setShowDropdown(false)}>
                  Proceed to checkout
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="mb-4 text-sm text-mt-muted">Your cart is empty</p>
              <Button to="/products" arrow onClick={() => setShowDropdown(false)}>
                Start shopping
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const UserProfile = () => (
    <Link
      to="/profile"
      className="flex h-11 items-center gap-2 rounded-full pl-1 pr-3 text-sm text-mt-text transition-colors hover:bg-mt-tint/10"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mt-surface-raised text-xs font-medium text-mt-text">
        {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
      </span>
      <span className="hidden xl:inline">{user?.name?.split(' ')[0] || 'User'}</span>
    </Link>
  );

  const isHome = location.pathname === '/';

  return (
    <header className="sticky top-0 z-50 border-b border-mt-line bg-mt-header font-brand text-mt-text">
      {bannerItems.length > 0 && (
        <div className="overflow-hidden border-b border-mt-line py-2">
          <style>{`
            @keyframes headerBannerMarquee {
              0% { transform: translate3d(0, 0, 0); }
              100% { transform: translate3d(-50%, 0, 0); }
            }
          `}</style>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-mt-header to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-mt-header to-transparent" />
            <div className="flex w-max min-w-full items-center gap-8 whitespace-nowrap px-4 text-[11px] uppercase tracking-[0.2em] text-mt-muted motion-reduce:animate-none [animation:headerBannerMarquee_24s_linear_infinite]">
              {marqueeBannerItems.map((item, index) => (
                <span
                  key={`${item.key}-${index}`}
                  className={
                    item.type === 'coupon'
                      ? 'rounded-mt-btn border border-mt-line-strong px-2.5 py-0.5 text-mt-text'
                      : ''
                  }
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-2 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-3 sm:h-16">
          <div className="flex items-center pl-2 sm:pl-0">
            <Wordmark />
          </div>

          <div className="hidden md:block">{renderSearchBox()}</div>

          <div className="flex items-center gap-1">
            <div className="hidden items-center xl:flex">
              <SocialMediaIcons />
            </div>

            <div className="hidden items-center gap-1 lg:flex">
              {isAuthenticated ? (
                <>
                  <UserProfile />
                  {userMenuItems.slice(1).map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="inline-flex h-11 items-center px-2.5 text-sm text-mt-muted transition-colors hover:text-mt-text"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex h-11 items-center px-2.5 text-sm text-mt-muted transition-colors hover:text-mt-danger"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex h-11 items-center px-2.5 text-sm text-mt-muted transition-colors hover:text-mt-text"
                  >
                    Sign in
                  </Link>
                  <Button to="/register" variant="outline" size="sm" className="ml-1">
                    Get started
                  </Button>
                </>
              )}
            </div>

            <Link
              to={isAuthenticated ? '/profile' : '/login'}
              className={cx(iconButtonClasses, 'hidden md:inline-flex lg:hidden')}
              aria-label={isAuthenticated ? 'My profile' : 'Sign in'}
            >
              <User className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={() => {
                setIsMobileSearchOpen((open) => !open);
                setIsSearchFocused(true);
              }}
              className={cx(iconButtonClasses, 'md:hidden')}
              aria-label={isMobileSearchOpen ? 'Close product search' : 'Open product search'}
              aria-expanded={isMobileSearchOpen}
            >
              {isMobileSearchOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Search className="h-[22px] w-[22px]" strokeWidth={1.6} aria-hidden="true" />
              )}
            </button>

            <div
              className="relative"
              onMouseEnter={() => window.innerWidth > 768 && setShowDropdown(true)}
              onMouseLeave={() => window.innerWidth > 768 && setShowDropdown(false)}
            >
              <CartIcon />
              {showDropdown && window.innerWidth > 768 && <CartDropdown />}
            </div>

            <button
              type="button"
              className={cx(iconButtonClasses, 'md:hidden')}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {isMobileSearchOpen && (
          <div className="px-2 pb-3 md:hidden">{renderSearchBox({ mobile: true })}</div>
        )}

        <div className="flex items-center justify-between gap-6 px-2 sm:px-0">
          <nav aria-label="Main" className="w-full md:w-auto">
            <ul className="flex items-center justify-between gap-6 md:justify-start md:gap-8">
              {navItems.map((item) => {
                const isActive = isRouteActive(item.path);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      aria-current={isActive ? 'page' : undefined}
                      className={cx(
                        '-mb-px inline-flex border-b-2 pb-2.5 pt-1 text-[13px] transition-colors sm:text-sm',
                        isActive
                          ? 'border-mt-accent text-mt-text'
                          : 'border-transparent text-mt-muted hover:text-mt-text'
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="hidden shrink-0 items-center gap-2 pb-2 md:flex">
            <Button to="/products" variant="accent" size="sm">
              Shop products
            </Button>
            <Button to="/customproducts" size="sm">
              Customize
            </Button>
          </div>
        </div>

        {isHome && (
          <div className="grid grid-cols-2 gap-3 px-2 pb-3.5 pt-3 md:hidden">
            <Button to="/customproducts" fullWidth className="h-10">
              Customize
            </Button>
            <Button to="/products" variant="accent" fullWidth className="h-10">
              Shop products
            </Button>
          </div>
        )}
      </div>

      {isMobileMenuOpen && (
        <div className="absolute inset-x-0 top-full z-40 border-b border-mt-line bg-mt-header md:hidden">
          <div className="max-h-[min(75vh,36rem)] overflow-y-auto px-4 pb-6 pt-2">
            {isAuthenticated && (
              <div className="flex items-center gap-3 border-b border-mt-line py-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mt-surface-raised text-sm font-medium">
                  {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-mt-text">{user?.name || 'User'}</p>
                  <p className="truncate text-xs text-mt-subtle">{user?.email || ''}</p>
                </div>
              </div>
            )}

            <ul className="divide-y divide-mt-line">
              {[...navItems, ...(isAuthenticated ? userMenuItems : [])].map((item) => {
                const isActive = isRouteActive(item.path);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      aria-current={isActive ? 'page' : undefined}
                      className={cx(
                        'flex h-14 items-center justify-between text-base transition-colors',
                        isActive ? 'text-mt-text' : 'text-mt-muted hover:text-mt-text'
                      )}
                    >
                      <span>{item.label}</span>
                      <span aria-hidden="true" className="text-mt-subtle">
                        &rarr;
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6">
              <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-mt-subtle">Connect with us</p>
              <SocialMediaIcons mobile />
            </div>

            {isAuthenticated ? (
              <Button
                variant="outline"
                fullWidth
                onClick={handleLogout}
                className="mt-6 border-mt-line-strong text-mt-danger hover:bg-mt-danger/10"
              >
                Logout
              </Button>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button to="/login" variant="outline" fullWidth>
                  Sign in
                </Button>
                <Button to="/register" fullWidth>
                  Get started
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
