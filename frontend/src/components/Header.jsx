import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser, selectCurrentToken } from '../redux/slices/Userslice.js';
import {
  getCart,
  selectCart,
  selectCartItemCount,
  selectCartSummary,
  selectCartLoading,
} from '../redux/slices/Cartslice.js';

const API_URL = import.meta.env.VITE_API_URL || 'https://maitrova.in/backend/api';
const DEFAULT_BANNER_MESSAGES = [
  'Free Shipping Nationwide',
  'Custom Designs in 48 Hours',
  'Premium Quality Guaranteed',
];

const socialLinks = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    href: 'https://wa.me/919390319652',
    desktopClass: 'border-emerald-100 bg-emerald-50/80 text-emerald-600 hover:border-emerald-200 hover:bg-emerald-100/80 hover:text-emerald-700',
    mobileIconClass: 'bg-emerald-100 text-emerald-600',
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
    desktopClass: 'border-fuchsia-100 bg-fuchsia-50/80 text-fuchsia-600 hover:border-fuchsia-200 hover:bg-fuchsia-100/80 hover:text-fuchsia-700',
    mobileIconClass: 'bg-fuchsia-100 text-fuchsia-600',
    icon: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 3.675A6.163 6.163 0 1012 18a6.163 6.163 0 000-12.325zm0 10.162A4 4 0 1112 8a4 4 0 010 8zm6.406-11.845a1.44 1.44 0 101.441 1.44 1.441 1.441 0 00-1.441-1.44z" />
      </svg>
    ),
  },
  {
    key: 'facebook',
    label: 'Facebook',
    href: 'https://facebook.com/maitrova',
    desktopClass: 'border-sky-100 bg-sky-50/80 text-sky-600 hover:border-sky-200 hover:bg-sky-100/80 hover:text-sky-700',
    mobileIconClass: 'bg-sky-100 text-sky-600',
    icon: (
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
];

const navItems = [
  { path: '/allproducts', label: 'Products' },
  { path: '/customproducts', label: 'Custom Design' },
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
  item?.dropproduct?.thumbnail ||
  item?.dropproduct?.images?.[0] ||
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
  <div className={`flex items-center ${mobile ? 'flex-wrap gap-2.5' : 'gap-2'}`}>
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
            ? 'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50'
            : `inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.desktopClass}`
        }
      >
        {mobile ? (
          <>
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${item.mobileIconClass}`}>{item.icon}</span>
            <span>{item.label}</span>
          </>
        ) : (
          item.icon
        )}
      </a>
    ))}
  </div>
);

const Header = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [bannerMessages, setBannerMessages] = useState(DEFAULT_BANNER_MESSAGES);
  const [bannerCouponCode, setBannerCouponCode] = useState('');

  const location = useLocation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.userInfo);
  const token = useSelector(selectCurrentToken);
  const cartItemCount = useSelector(selectCartItemCount);
  const cart = useSelector(selectCart);
  const cartSummary = useSelector(selectCartSummary);
  const cartLoading = useSelector(selectCartLoading);
  const isAuthenticated = !!token;

  useEffect(() => {
    dispatch(getCart());
  }, [dispatch, token]);

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
    setShowDropdown(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  const isRouteActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleLogout = () => {
    dispatch(logoutUser());
    setIsMobileMenuOpen(false);
  };

  const CartIcon = () => (
    <Link
      to="/cart"
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 hover:shadow-md"
      onClick={() => setIsMobileMenuOpen(false)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      {cartItemCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-semibold text-white">
          {cartItemCount > 9 ? '9+' : cartItemCount}
        </span>
      )}
    </Link>
  );

  const CartDropdown = () => (
    <div className="absolute right-0 mt-4 w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_34px_80px_-42px_rgba(15,23,42,0.45)]">
      <div className="border-b border-slate-100 bg-[linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Shopping Cart</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">{cartItemCount ? `${cartItemCount} item${cartItemCount > 1 ? 's' : ''}` : 'No items yet'}</h3>
          </div>
          <Link to="/cart" className="text-xs font-semibold text-slate-600 transition hover:text-slate-900" onClick={() => setShowDropdown(false)}>
            Open cart
          </Link>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto p-4">
        {cartLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading cart...</div>
        ) : cart?.items?.length ? (
          <div className="space-y-3">
            {cart.items.slice(0, 3).map((item) => {
              const imageSrc = getCartItemImage(item);
              const itemTitle = getCartItemTitle(item);

              return (
              <div key={item._id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white">
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={itemTitle}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Item</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{itemTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">Qty {item.qty} | {formatCurrency(item.unitPrice)}</p>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {formatCurrency((item.unitPrice || 0) * (item.qty || 0))}
                </div>
              </div>
            )})}

            {cart.items.length > 3 && (
              <p className="text-center text-xs font-medium text-slate-500">+{cart.items.length - 3} more items</p>
            )}

            <div className="border-t border-slate-200 pt-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(cartSubtotal)}</span>
              </div>
              <Link
                to="/checkout"
                className="block rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => setShowDropdown(false)}
              >
                Proceed to Checkout
              </Link>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="mb-4 text-sm text-slate-500">Your cart is empty</p>
            <Link
              to="/allproducts"
              className="inline-flex rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => setShowDropdown(false)}
            >
              Start Shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  const UserProfile = () => (
    <Link
      to="/profile"
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2 py-2 pr-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
    >
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#0f172a,_#334155)] text-sm font-semibold text-white">
          {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
      </div>
      <div className="hidden lg:block">
        <p className="text-sm font-semibold text-slate-800">{user?.name?.split(' ')[0] || 'User'}</p>
      </div>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-[rgba(248,250,252,0.88)] shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl">
      {bannerItems.length > 0 && (
        <div className="overflow-hidden border-b border-slate-200/80 bg-[linear-gradient(90deg,_#eff6ff,_#f8fafc,_#fff7ed)] py-1.5">
          <style>{`
            @keyframes headerBannerMarquee {
              0% { transform: translate3d(0, 0, 0); }
              100% { transform: translate3d(-50%, 0, 0); }
            }
          `}</style>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-orange-50 via-orange-50/80 to-transparent" />
            <div className="flex w-max min-w-full items-center gap-3 whitespace-nowrap px-4 text-[12px] font-medium text-slate-600 motion-reduce:animate-none [animation:headerBannerMarquee_24s_linear_infinite]">
              {marqueeBannerItems.map((item, index) => (
                <span
                  key={`${item.key}-${index}`}
                  className={
                    item.type === 'coupon'
                      ? 'rounded-full border border-amber-200 bg-amber-50/90 px-3 py-1 font-semibold uppercase tracking-[0.12em] text-amber-700 shadow-sm'
                      : 'rounded-full border border-sky-100 bg-white/90 px-3 py-1 text-sky-700 shadow-sm'
                  }
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-2 py-1.5 sm:px-3">
        <div className="relative overflow-visible rounded-[1.5rem] border border-white/70 bg-[linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.94))] px-2.5 py-2 shadow-[0_26px_60px_-36px_rgba(15,23,42,0.35)] md:px-4">
          <div className="absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.08),_transparent_28%)]" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-5">
              <button
                className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-md md:hidden"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              <Link to="/" className="group flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/80 bg-white shadow-md transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
                  <img
                    src="/logo/logo.jpeg"
                    alt="MAITROVA"
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.target.onerror = null;
                      event.target.style.display = 'none';
                      const fallbackNode = document.createElement('span');
                      fallbackNode.className = 'text-sm font-bold text-slate-800';
                      fallbackNode.textContent = 'M';
                      event.target.parentElement.appendChild(fallbackNode);
                    }}
                  />
                </div>
                <div className="hidden sm:block">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Maitrova</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">Premium custom wear</p>
                    <span className="hidden rounded-full border border-orange-100 bg-orange-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-700 lg:inline-flex">
                      Fresh drops
                    </span>
                  </div>
                </div>
              </Link>
            </div>

            <nav className="hidden md:flex">
              <div className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 p-1 shadow-sm">
                {navItems.map((item) => {
                  const isActive = isRouteActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-[linear-gradient(135deg,_#2563eb,_#7c3aed)] text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-3 xl:flex">
                <SocialMediaIcons />
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                {isAuthenticated ? (
                  <>
                    <UserProfile />
                    {userMenuItems.slice(1).map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <button
                      onClick={handleLogout}
                      className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className="rounded-2xl bg-[linear-gradient(135deg,_#0f172a,_#1e293b)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 hover:shadow-md"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>

              <div
                className="relative"
                onMouseEnter={() => window.innerWidth > 768 && setShowDropdown(true)}
                onMouseLeave={() => window.innerWidth > 768 && setShowDropdown(false)}
              >
                <div className="flex items-center gap-2 rounded-2xl border border-sky-100 bg-[linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(239,246,255,0.9))] px-2 py-2 shadow-sm md:pl-2 md:pr-3">
                  <CartIcon />
                  <div className="hidden md:block">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-500">Cart Total</div>
                    <div className="text-sm font-semibold text-slate-900">{formatCurrency(cartSubtotal)}</div>
                  </div>
                </div>
                {showDropdown && window.innerWidth > 768 && <CartDropdown />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="absolute inset-x-0 top-full z-40 px-3 pt-2 md:hidden">
          <div className="mx-auto max-w-sm overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] shadow-[0_28px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur-xl">
            <div className="max-h-[min(70vh,32rem)] overflow-y-auto p-3">
            {isAuthenticated && (
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/80 p-3 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#0f172a,_#334155)] text-sm font-semibold text-white">
                  {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{user?.name || 'User'}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email || ''}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    isRouteActive(item.path)
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={isRouteActive(item.path) ? 'text-white/70' : 'text-slate-400'}>&rarr;</span>
                </Link>
              ))}

              {isAuthenticated &&
                userMenuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      isRouteActive(item.path)
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={isRouteActive(item.path) ? 'text-white/70' : 'text-slate-400'}>&rarr;</span>
                  </Link>
                ))}
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Connect With Us</p>
              <SocialMediaIcons mobile />
            </div>

            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="mt-4 w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
              >
                Logout
              </button>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="rounded-2xl bg-[linear-gradient(135deg,_#0f172a,_#1e293b)] px-4 py-3 text-center text-sm font-medium text-white transition hover:opacity-95"
                >
                  Get Started
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
