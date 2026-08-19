import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  upsertDeliveryBilling,
  fetchMyAddresses,
  updateAddress,
  setDefaultAddress,
  resetAddressState,
  selectDeliveryAddress,
  selectBillingAddress,
  selectAddressLoading,
  selectAddressError,
  selectAddressSuccess,
  selectAddressMessage,
} from "../redux/slices/address.js";
import { getCart, selectCartItems, selectCartSummary } from "../redux/slices/Cartslice.js";
import { selectCurrentToken } from "../redux/slices/Userslice.js";
import RazorpayPayNow from "../components/RazorpayPayNow.jsx";
import { trackAddPaymentInfo, trackBeginCheckoutOnce, trackPurchaseOnce } from "../utils/analytics.js";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/api";

const emptyAddress = { fullName: "", mobileNumber: "", completeAddress: "", landmark: "", pincode: "", city: "", state: "" };
const emptyCouponState = { code: "", status: "idle", message: "", discount: 0, coupon: null, subtotal: null };

const buildPurchaseItems = (items = []) =>
  items.map((item) => {
    const productSource =
      item?.dropproduct ||
      item?.readymadeProduct ||
      item?.design ||
      item?.product ||
      null;

    const productId =
      productSource?._id ||
      item?.dropproductId ||
      item?.readymadeProductId ||
      item?.designId ||
      item?.productId ||
      item?._id ||
      "";

    const productName =
      productSource?.title ||
      productSource?.name ||
      productSource?.designName ||
      (item?.kind === "DESIGN" ? "Customized Product" : "Product");

    const quantity = Number(item?.qty || item?.quantity || 1);
    const unitPrice = Number(
      item?.unitPrice ??
        productSource?.effectivePrice ??
        productSource?.price ??
        productSource?.basePrice ??
        0
    );

    return {
      id: String(productId),
      name: productName,
      quantity,
      item_price: unitPrice,
      kind: item?.kind || "PRODUCT",
      size: item?.size || item?.selectedSize || "",
    };
  });

function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:tracking-[0.24em]">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 sm:rounded-2xl sm:px-4" />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:tracking-[0.24em]">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 sm:rounded-2xl sm:px-4" />
    </div>
  );
}

function AddressSummary({ title, addr, onEdit, onMakeDefault, loading }) {
  return (
    <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#f8fafc)] p-4 shadow-[0_20px_55px_-38px_rgba(15,23,42,0.45)] sm:rounded-[24px] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 sm:tracking-[0.22em]">{title}</h4>
            {addr?.isDefault ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Default</span> : null}
          </div>
          {addr ? (
            <div className="mt-3 space-y-1 break-words text-sm text-slate-700">
              <div className="font-semibold text-slate-900">{addr.fullName}</div>
              <div className="text-slate-600">{addr.mobileNumber}</div>
              <div>{addr.completeAddress}</div>
              {addr.landmark ? <div className="text-slate-600">Landmark: {addr.landmark}</div> : null}
              <div className="text-slate-600">{addr.city}, {addr.state} - {addr.pincode}</div>
            </div>
          ) : <div className="mt-2 text-sm text-slate-500">No address saved yet.</div>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
          <button onClick={onEdit} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50">Edit</button>
          {addr?._id && !addr?.isDefault ? <button disabled={loading} onClick={onMakeDefault} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">Make default</button> : null}
        </div>
      </div>
    </div>
  );
}

function PriceRow({ label, value, valueClassName = "font-medium text-slate-900" }) {
  return <div className="flex items-center justify-between text-sm"><span className="text-slate-600">{label}</span><span className={valueClassName}>{value}</span></div>;
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function CouponCelebration({ visible, code, discount }) {
  if (!visible) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_35%),linear-gradient(135deg,_#ecfdf5,_#f8fafc_55%,_#ecfeff)] p-4 shadow-sm">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-6 top-4 h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400/80" />
        <div className="absolute right-10 top-8 h-2 w-2 animate-bounce rounded-full bg-sky-400/80" />
      </div>
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.13 7.13a1 1 0 01-1.414 0l-3.164-3.164a1 1 0 111.414-1.415l2.457 2.457 6.423-6.423a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Savings Unlocked</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{code} is live on this checkout</div>
          <p className="mt-1 text-sm text-slate-600">Discount applied: <span className="font-semibold text-emerald-700">Rs. {discount.toFixed(2)}</span></p>
        </div>
      </div>
    </div>
  );
}

const formatCouponPrimaryText = (coupon) => {
  if (!coupon) return "";
  if (coupon.discountType === "PERCENTAGE") {
    const maxText =
      coupon.maximumDiscountAmount !== null && coupon.maximumDiscountAmount !== undefined
        ? ` up to Rs.${Number(coupon.maximumDiscountAmount).toFixed(0)}`
        : "";
    return `${Number(coupon.discountValue || 0).toFixed(0)}% off${maxText}`;
  }
  return `Flat Rs.${Number(coupon.discountValue || 0).toFixed(0)} off`;
};

const formatCouponMeta = (coupon) => {
  if (!coupon) return "";
  const parts = [];
  if (Number(coupon.minimumCartAmount || 0) > 0) {
    parts.push(`Min order Rs.${Number(coupon.minimumCartAmount).toFixed(0)}`);
  }
  if (coupon.firstOrderOnly || coupon.newCustomersOnly) {
    parts.push("First order only");
  }
  if (coupon.allowOnSaleProducts) {
    parts.push("Works on sale items");
  }
  if (coupon.autoApply) {
    parts.push("Auto apply");
  }
  return parts.join(" | ");
};

const formatCouponExpiry = (coupon) => {
  if (!coupon?.endDate) return "";
  const endDate = new Date(coupon.endDate);
  if (Number.isNaN(endDate.getTime())) return "";
  return `Valid till ${endDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
};

function AvailableCoupons({ coupons, loading, copiedCouponCode, onCopy }) {
  return (
    <div className="w-full min-w-0 rounded-2xl border border-emerald-100 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(180deg,_#ffffff,_#f0fdf4)] p-4 shadow-sm sm:rounded-[24px] sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 sm:tracking-[0.26em]">
            Eligible Coupons
          </div>
          <h4 className="mt-1 text-lg font-semibold text-slate-900">
            Pick an offer for this checkout
          </h4>
        </div>
        <div className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
          {loading ? "Loading..." : `${coupons.length} eligible`}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((item) => (
            <div key={item} className="animate-pulse rounded-2xl border border-white/80 bg-white/90 p-3">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-40 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-full rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : coupons.length ? (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div key={coupon.code} className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex max-w-full rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
                    {coupon.code}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatCouponPrimaryText(coupon)}
                  </p>
                  {Number(coupon.discountApplied || 0) > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      Saves Rs. {Number(coupon.discountApplied || 0).toFixed(2)}
                    </p>
                  ) : null}
                  {coupon.description ? (
                    <p className="mt-1 text-xs leading-5 text-slate-600">{coupon.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(coupon.code)}
                  className={`w-fit shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                    copiedCouponCode === coupon.code
                      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {copiedCouponCode === coupon.code ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {formatCouponMeta(coupon) ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    {formatCouponMeta(coupon)}
                  </span>
                ) : null}
                {formatCouponExpiry(coupon) ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {formatCouponExpiry(coupon)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
          No eligible coupons for these cart items right now.
        </div>
      )}
    </div>
  );
}

export default function CheckoutAddresses() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector(selectCurrentToken);
  const deliverySaved = useSelector(selectDeliveryAddress);
  const billingSaved = useSelector(selectBillingAddress);
  const loading = useSelector(selectAddressLoading);
  const error = useSelector(selectAddressError);
  const success = useSelector(selectAddressSuccess);
  const message = useSelector(selectAddressMessage);
  const cartItems = useSelector(selectCartItems);
  const cartSummary = useSelector(selectCartSummary);

  const [sameAsDelivery, setSameAsDelivery] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [mode, setMode] = useState("create");
  const [delivery, setDelivery] = useState(emptyAddress);
  const [billing, setBilling] = useState(emptyAddress);
  const [couponCode, setCouponCode] = useState("");
  const [couponState, setCouponState] = useState(emptyCouponState);
  const [pricingPreview, setPricingPreview] = useState(null);
  const [showCouponCelebration, setShowCouponCelebration] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [copiedCouponCode, setCopiedCouponCode] = useState("");
  const [codLoading, setCodLoading] = useState(false);
  const [codError, setCodError] = useState("");
  const [codMinimumOrderAmount, setCodMinimumOrderAmount] = useState(0);
  const [openDeliverySection, setOpenDeliverySection] = useState(false);
  const [openBillingSection, setOpenBillingSection] = useState(false);
  const hasTrackedBeginCheckoutRef = useRef(false);
  const isEditing = useMemo(() => mode.startsWith("edit"), [mode]);
  const normalizedCouponCode = useMemo(() => String(couponCode || "").trim().toUpperCase(), [couponCode]);
  const isCouponApplied = couponState.status === "applied" && couponState.code === normalizedCouponCode;
  const checkoutDisabled = !deliverySaved || !billingSaved || cartItems.length === 0;
  const effectiveSubtotal = Number(pricingPreview?.subtotal ?? cartSummary.subtotal ?? 0);
  const effectiveShipping = Number(pricingPreview?.shipping ?? 0);
  const effectiveDiscount = Number(pricingPreview?.discount ?? couponState.discount ?? 0);
  const effectiveTotal = Number(pricingPreview?.total ?? Math.max(0, effectiveSubtotal + effectiveShipping - effectiveDiscount));
  const hasCustomizationItems = useMemo(
    () => cartItems.some((item) => item?.kind === "DESIGN" || Boolean(item?.product)),
    [cartItems]
  );
  const getPaymentOptions = (item) => {
    if (item?.kind === "DESIGN" || Boolean(item?.product)) {
      return ["ONLINE"];
    }

    const product = item?.kind === "COMBO"
      ? item?.comboPack
      : item?.dropproduct || item?.readymadeProduct;
    const options = Array.isArray(product?.paymentOptions) ? product.paymentOptions : ["COD", "ONLINE"];
    return options.length ? options : ["COD", "ONLINE"];
  };
  const getPaymentLabel = (options = []) => {
    const allowsCod = options.includes("COD");
    const allowsOnline = options.includes("ONLINE");

    if (allowsCod && allowsOnline) return "COD + Online";
    if (allowsCod) return "COD only";
    if (allowsOnline) return "Online only";
    return "Payment unavailable";
  };
  const getPaymentBadgeClass = (options = []) => {
    const allowsCod = options.includes("COD");
    const allowsOnline = options.includes("ONLINE");

    if (allowsCod && allowsOnline) return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (allowsCod) return "border-amber-200 bg-amber-50 text-amber-800";
    if (allowsOnline) return "border-sky-200 bg-sky-50 text-sky-700";
    return "border-rose-200 bg-rose-50 text-rose-700";
  };
  const codRestrictedItems = useMemo(
    () => cartItems.filter((item) => !getPaymentOptions(item).includes("COD")),
    [cartItems]
  );
  const onlineRestrictedItems = useMemo(
    () => cartItems.filter((item) => !getPaymentOptions(item).includes("ONLINE")),
    [cartItems]
  );
  const codBelowMinimum = effectiveTotal < Number(codMinimumOrderAmount || 0);
  const onlineDisabled = checkoutDisabled || codLoading || onlineRestrictedItems.length > 0;
  const codDisabled = checkoutDisabled || codLoading || hasCustomizationItems || codBelowMinimum || codRestrictedItems.length > 0;
  const codHelperMessage = hasCustomizationItems
    ? "Cash on delivery is not available for customization products."
    : codRestrictedItems.length > 0
      ? "Cash on delivery is not available for one or more items in your cart."
      : codBelowMinimum && codMinimumOrderAmount > 0
      ? `Cash on delivery is available only for orders of Rs. ${Number(codMinimumOrderAmount).toFixed(2)} or more.`
      : "";
  const onlineHelperMessage = onlineRestrictedItems.length > 0
    ? "Online payment is not available for one or more items in your cart."
    : "";

  useEffect(() => {
    if (!token) {
      navigate("/login", { state: { from: "/checkout" }, replace: true });
      return undefined;
    }

    dispatch(fetchMyAddresses());
    dispatch(getCart());
    return () => dispatch(resetAddressState());
  }, [dispatch, navigate, token]);

  useEffect(() => {
    if (deliverySaved) setDelivery((prev) => ({ ...prev, fullName: deliverySaved.fullName || "", mobileNumber: deliverySaved.mobileNumber || "", completeAddress: deliverySaved.completeAddress || "", landmark: deliverySaved.landmark || "", pincode: deliverySaved.pincode || "", city: deliverySaved.city || "", state: deliverySaved.state || "" }));
    if (billingSaved) setBilling((prev) => ({ ...prev, fullName: billingSaved.fullName || "", mobileNumber: billingSaved.mobileNumber || "", completeAddress: billingSaved.completeAddress || "", landmark: billingSaved.landmark || "", pincode: billingSaved.pincode || "", city: billingSaved.city || "", state: billingSaved.state || "" }));
  }, [deliverySaved, billingSaved]);

  useEffect(() => {
    if (mode === "edit-delivery") {
      setOpenDeliverySection(true);
    }
    if (mode === "edit-billing") {
      setOpenBillingSection(true);
    }
  }, [mode]);

  useEffect(() => {
    if (hasTrackedBeginCheckoutRef.current || !cartItems.length) return;

    hasTrackedBeginCheckoutRef.current = true;
    trackBeginCheckoutOnce({
      items: cartItems,
      value: cartSummary.total,
      currency: "INR",
      coupon: normalizedCouponCode,
    });
  }, [cartItems.length, cartSummary.total, normalizedCouponCode]);

  useEffect(() => {
    if (sameAsDelivery) setBilling((prev) => ({ ...prev, ...delivery }));
  }, [delivery, sameAsDelivery]);

  useEffect(() => {
    if (!showCouponCelebration) return undefined;
    const timer = window.setTimeout(() => setShowCouponCelebration(false), 2600);
    return () => window.clearTimeout(timer);
  }, [showCouponCelebration]);

  useEffect(() => {
    let cancelled = false;

    const loadCoupons = async () => {
      if (!token) return;

      try {
        setLoadingCoupons(true);
        const res = await fetch(`${API_URL}/coupons/eligible`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || "Failed to load coupons");
        }
        if (!cancelled) {
          setAvailableCoupons(Array.isArray(data?.coupons) ? data.coupons : []);
        }
      } catch (couponError) {
        console.error("Failed to load coupons:", couponError);
        if (!cancelled) {
          setAvailableCoupons([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingCoupons(false);
        }
      }
    };

    loadCoupons();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCodSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/header-banner`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || "Failed to load store settings");
        }
        if (!cancelled) {
          setCodMinimumOrderAmount(Number(data?.codMinimumOrderAmount || 0));
        }
      } catch (settingsError) {
        if (!cancelled) {
          setCodMinimumOrderAmount(0);
        }
      }
    };

    loadCodSettings();

    return () => {
      cancelled = true;
    };
  }, [token, cartItems.length, cartSummary.subtotal]);

  const handleChange = (which, key, value) => {
    if (which === "delivery") {
      setDelivery((prev) => ({ ...prev, [key]: value }));
      if (sameAsDelivery) setBilling((prev) => ({ ...prev, [key]: value }));
      return;
    }
    setBilling((prev) => ({ ...prev, [key]: value }));
  };

  const validateLocal = (addr) => {
    for (const field of ["fullName", "mobileNumber", "completeAddress", "pincode", "city", "state"]) {
      if (!addr[field] || String(addr[field]).trim() === "") return `Please fill ${field}`;
    }
    return null;
  };

  const onSave = async () => {
    const deliveryError = validateLocal(delivery);
    if (deliveryError) return alert(deliveryError);
    if (!sameAsDelivery) {
      const billingError = validateLocal(billing);
      if (billingError) return alert(billingError);
    }
    await dispatch(upsertDeliveryBilling({ sameAsDelivery, setAsDefault, delivery, ...(sameAsDelivery ? {} : { billing }) }));
    dispatch(fetchMyAddresses());
  };

  const onUpdate = async () => {
    if (mode === "edit-delivery") {
      if (!deliverySaved?._id) return;
      const deliveryError = validateLocal(delivery);
      if (deliveryError) return alert(deliveryError);
      await dispatch(updateAddress({ id: deliverySaved._id, updates: delivery }));
      dispatch(fetchMyAddresses());
      setMode("create");
      return;
    }
    if (mode === "edit-billing") {
      if (!billingSaved?._id) return;
      const billingError = validateLocal(billing);
      if (billingError) return alert(billingError);
      await dispatch(updateAddress({ id: billingSaved._id, updates: billing }));
      dispatch(fetchMyAddresses());
      setMode("create");
    }
  };

  const onMakeDefault = async (addrId) => {
    await dispatch(setDefaultAddress(addrId));
    dispatch(fetchMyAddresses());
  };

  const resetCouponFeedback = () => {
    setCouponState(emptyCouponState);
    setPricingPreview(null);
    setShowCouponCelebration(false);
  };

  const handleValidateCoupon = async () => {
    if (!token) return;
    if (!normalizedCouponCode) {
      setCouponState({ ...emptyCouponState, status: "error", message: "Enter a coupon code" });
      setPricingPreview(null);
      return;
    }
    setCouponState((prev) => ({ ...prev, code: normalizedCouponCode, status: "validating", message: "" }));
    try {
      const res = await fetch(`${API_URL}/coupons/validate`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ couponCode: normalizedCouponCode }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to validate coupon");
      const subtotal = Number(data.subtotal || cartSummary.subtotal || 0);
      const discount = Number(data.discount || 0);
      setCouponState({ code: normalizedCouponCode, status: "applied", message: "Coupon applied", discount, coupon: data.coupon || null, subtotal });
      setPricingPreview({ subtotal, shipping: 0, discount, total: Math.max(0, subtotal - discount), coupon: data.coupon || null });
      setShowCouponCelebration(true);
    } catch (validationError) {
      setCouponState({ ...emptyCouponState, code: normalizedCouponCode, status: "error", message: validationError.message || "Failed to validate coupon" });
      setPricingPreview(null);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode("");
    resetCouponFeedback();
  };

  const handleCopyCoupon = async (couponCodeToCopy) => {
    if (!couponCodeToCopy) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(couponCodeToCopy);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = couponCodeToCopy;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCouponCode(couponCodeToCopy);
      setCopiedCouponCode(couponCodeToCopy);
      window.setTimeout(() => {
        setCopiedCouponCode((currentCode) =>
          currentCode === couponCodeToCopy ? "" : currentCode
        );
      }, 1800);
    } catch (copyError) {
      console.error("Failed to copy coupon:", copyError);
    }
  };

  const handleOrderCreated = (created) => {
    const pricing = created?.pricing;
    if (!pricing) return;
    setPricingPreview({ subtotal: Number(pricing.subtotal || 0), shipping: Number(pricing.shipping || 0), discount: Number(pricing.discount || 0), total: Number(pricing.total || 0), coupon: pricing.coupon || null });
  };

  const handleOrderSuccess = ({ orderId, paymentLabel, totalAmount }) => {
    const purchaseItems = buildPurchaseItems(cartItems);
    const purchaseTotal = Number(totalAmount || 0);

    trackPurchaseOnce({
      transactionId: orderId,
      items: purchaseItems,
      value: purchaseTotal,
      currency: "INR",
      paymentType: paymentLabel || "",
    });

    dispatch(getCart());
    navigate("/checkout/success", {
      replace: true,
      state: {
        orderSuccess: {
          orderId,
          paymentLabel,
          totalAmount: purchaseTotal,
          items: purchaseItems,
          itemCount: purchaseItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
          createdAt: Date.now(),
        },
      },
    });
  };

  const handleCashOnDelivery = async () => {
    if (!token || checkoutDisabled) return;

    setCodLoading(true);
    setCodError("");
    trackAddPaymentInfo({
      items: cartItems,
      value: effectiveTotal,
      currency: "INR",
      coupon: isCouponApplied ? normalizedCouponCode : "",
      paymentType: "Cash on Delivery",
    });

    try {
      const res = await fetch(`${API_URL}/payment/cod/create-from-cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          isCouponApplied ? { couponCode: normalizedCouponCode } : {}
        ),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to create cash on delivery order");
      }

      handleOrderCreated(data);
      handleOrderSuccess({
        orderId: data?.orderId || data?.order?._id || "",
        paymentLabel: "Cash on Delivery",
        totalAmount: effectiveTotal,
      });
    } catch (cashOnDeliveryError) {
      setCodError(cashOnDeliveryError.message || "Failed to place cash on delivery order");
    } finally {
      setCodLoading(false);
    }
  };

  const headerTitle = mode === "edit-delivery" ? "Edit Delivery Address" : mode === "edit-billing" ? "Edit Billing Address" : "Delivery & Billing Address";

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-100">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:py-8">
        <div className="mb-4 flex min-w-0 flex-col gap-3 sm:mb-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.28em]">Checkout</div>
            <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900 sm:mt-2 sm:text-3xl">Review your order</h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
              A cleaner checkout flow focused on shipping, payment, and final review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/cart")}
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Back to cart
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {success && message ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600 sm:mb-6 sm:px-4 sm:text-sm">
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            <span><span className="font-semibold text-slate-900">1.</span> Shipping address</span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <span><span className="font-semibold text-slate-900">2.</span> Payment method</span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <span><span className="font-semibold text-slate-900">3.</span> Review and place order</span>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-6">
          <div className="min-w-0 space-y-4 sm:space-y-6">
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
              <AddressSummary
                title="Delivery"
                addr={deliverySaved}
                loading={loading}
                onEdit={() => setMode("edit-delivery")}
                onMakeDefault={() => onMakeDefault(deliverySaved._id)}
              />
              <AddressSummary
                title="Billing"
                addr={billingSaved}
                loading={loading}
                onEdit={() => setMode("edit-billing")}
                onMakeDefault={() => onMakeDefault(billingSaved._id)}
              />
            </div>

            <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Shipping details</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Update your delivery and billing information before paying.
                  </p>
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">
                  {isEditing ? "Editing" : "Create / Save"}
                </div>
              </div>

              <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setOpenDeliverySection((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Delivery address</div>
                      <div className="mt-1 text-xs text-slate-500">Click to open or close</div>
                    </div>
                    <span className="shrink-0 text-slate-500">{openDeliverySection ? "-" : "+"}</span>
                  </button>
                  {openDeliverySection ? (
                    <div className="border-t border-slate-200 bg-white p-4">
                      <div className="space-y-4">
                        <Input label="Full Name" value={delivery.fullName} onChange={(value) => handleChange("delivery", "fullName", value)} placeholder="Full name" />
                        <Input label="Mobile Number" value={delivery.mobileNumber} onChange={(value) => handleChange("delivery", "mobileNumber", value)} placeholder="Mobile number" type="tel" />
                        <TextArea label="Complete Address" value={delivery.completeAddress} onChange={(value) => handleChange("delivery", "completeAddress", value)} placeholder="House no, street, area" />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Input label="Pincode" value={delivery.pincode} onChange={(value) => handleChange("delivery", "pincode", value)} placeholder="Pincode" />
                          <Input label="City" value={delivery.city} onChange={(value) => handleChange("delivery", "city", value)} placeholder="City" />
                        </div>
                        <Input label="State" value={delivery.state} onChange={(value) => handleChange("delivery", "state", value)} placeholder="State" />
                        <Input label="Landmark" value={delivery.landmark} onChange={(value) => handleChange("delivery", "landmark", value)} placeholder="Landmark (optional)" />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setOpenBillingSection((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Billing address</div>
                      <div className="mt-1 text-xs text-slate-500">Click to open or close</div>
                    </div>
                    <span className="shrink-0 text-slate-500">{openBillingSection ? "-" : "+"}</span>
                  </button>
                  {openBillingSection ? (
                    <div className="border-t border-slate-200 bg-white p-4">
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={sameAsDelivery}
                          onChange={(e) => setSameAsDelivery(e.target.checked)}
                          disabled={mode === "edit-billing"}
                        />
                        Same as delivery address
                      </label>
                      <div className={`mt-4 space-y-4 ${sameAsDelivery ? "opacity-60" : ""}`}>
                        <Input label="Full Name" value={billing.fullName} onChange={(value) => handleChange("billing", "fullName", value)} placeholder="Full name" />
                        <Input label="Mobile Number" value={billing.mobileNumber} onChange={(value) => handleChange("billing", "mobileNumber", value)} placeholder="Mobile number" type="tel" />
                        <TextArea label="Complete Address" value={billing.completeAddress} onChange={(value) => handleChange("billing", "completeAddress", value)} placeholder="House no, street, area" />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Input label="Pincode" value={billing.pincode} onChange={(value) => handleChange("billing", "pincode", value)} placeholder="Pincode" />
                          <Input label="City" value={billing.city} onChange={(value) => handleChange("billing", "city", value)} placeholder="City" />
                        </div>
                        <Input label="State" value={billing.state} onChange={(value) => handleChange("billing", "state", value)} placeholder="State" />
                        <Input label="Landmark" value={billing.landmark} onChange={(value) => handleChange("billing", "landmark", value)} placeholder="Landmark (optional)" />
                      </div>
                      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={setAsDefault}
                          onChange={(e) => setSetAsDefault(e.target.checked)}
                        />
                        Set as default address
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
                  {isEditing ? "Updating saved address" : "Save your address before payment"}
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setMode("create")}
                        className="w-full rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={onUpdate}
                        className="w-full rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                      >
                        {loading ? "Updating..." : "Update address"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={onSave}
                      className="w-full rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                    >
                      {loading ? "Saving..." : "Save address"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-4 sm:space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.24em]">Order summary</div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">Review items</h2>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {cartItems.length} items
                </div>
              </div>

              <div className="mt-4 max-h-72 space-y-3 overflow-auto pr-1">
                {cartItems.length ? cartItems.map((item, index) => {
                  const name =
                    item?.comboPack?.name ||
                    item?.dropproduct?.name ||
                    item?.readymadeProduct?.title ||
                    item?.design?.title ||
                    item?.product?.name ||
                    "Product";
                  const qty = Number(item?.qty || 1);
                  const price = Number(item?.unitPrice || 0) * qty;
                  const paymentOptions = getPaymentOptions(item);
                  return (
                    <div key={`${item?._id || index}-${index}`} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Qty: {qty}{item?.size ? ` | Size: ${item.size}` : ""}
                        </div>
                        {item?.kind === "COMBO" && Array.isArray(item.comboSelections) && item.comboSelections.length > 0 && (
                          <div className="mt-2 space-y-1 rounded-lg bg-white px-2 py-2">
                            {item.comboSelections.map((selection, selectionIndex) => (
                              <div key={`${selection.productId || selectionIndex}`} className="text-[11px] text-slate-600">
                                <span className="font-medium">{selection.productName || `Item ${selectionIndex + 1}`}</span>
                                {selection.size ? ` | Size: ${selection.size}` : ""}
                                {selection.color?.label || selection.color?.value
                                  ? ` | Color: ${selection.color.label || selection.color.value}`
                                  : ""}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPaymentBadgeClass(paymentOptions)}`}>
                            {getPaymentLabel(paymentOptions)}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-slate-900 sm:text-right">
                        Rs. {price.toFixed(2)}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    Your cart is empty.
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-2 border-t border-slate-200 pt-4">
                <PriceRow label="Subtotal" value={`Rs. ${effectiveSubtotal.toFixed(2)}`} />
                <PriceRow label="Shipping" value={effectiveShipping === 0 ? "FREE" : `Rs. ${effectiveShipping.toFixed(2)}`} />
                <PriceRow label="Coupon discount" value={effectiveDiscount > 0 ? `- Rs. ${effectiveDiscount.toFixed(2)}` : "Rs. 0.00"} valueClassName="font-semibold text-emerald-700" />
                <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3 text-base font-semibold text-slate-900">
                  <span>Total</span>
                  <span>Rs. {effectiveTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.24em]">Coupon</div>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">Apply code</h3>
                </div>
                {isCouponApplied ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Applied
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    if (couponState.status !== "idle") resetCouponFeedback();
                  }}
                  placeholder="Enter coupon code"
                  className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-medium uppercase tracking-[0.08em] text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 sm:tracking-[0.18em]"
                />
                <button
                  type="button"
                  onClick={handleValidateCoupon}
                  disabled={!normalizedCouponCode || couponState.status === "validating"}
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {couponState.status === "validating" ? "Checking..." : "Apply"}
                </button>
              </div>
              {(normalizedCouponCode || isCouponApplied) ? (
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="mt-3 text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
                >
                  Remove coupon
                </button>
              ) : null}
              {couponState.message && couponState.status !== "applied" ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {couponState.message}
                </div>
              ) : null}
            </div>

            <AvailableCoupons
              coupons={availableCoupons}
              loading={loadingCoupons}
              copiedCouponCode={copiedCouponCode}
              onCopy={handleCopyCoupon}
            />

            <CouponCelebration
              visible={showCouponCelebration}
              code={normalizedCouponCode}
              discount={effectiveDiscount}
            />

            <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.24em]">Payment</div>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">Choose how to pay</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Complete payment with Razorpay or place a cash on delivery order if it is available.
              </p>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Payable total</span>
                  <span className="text-base font-semibold text-slate-900">Rs. {effectiveTotal.toFixed(2)}</span>
                </div>
                {isCouponApplied ? (
                  <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {normalizedCouponCode} applied. You saved Rs. {effectiveDiscount.toFixed(2)}.
                  </div>
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                <RazorpayPayNow
                  token={token}
                  couponCode={isCouponApplied ? normalizedCouponCode : ""}
                  onSuccess={({ orderId }) => {
                    handleOrderSuccess({
                      orderId,
                      paymentLabel: "Online payment",
                      totalAmount: effectiveTotal,
                    });
                  }}
                  onOrderCreated={handleOrderCreated}
                  onPaymentInfo={() => {
                    trackAddPaymentInfo({
                      items: cartItems,
                      value: effectiveTotal,
                      currency: "INR",
                      coupon: isCouponApplied ? normalizedCouponCode : "",
                      paymentType: "Online payment",
                    });
                  }}
                  disabled={onlineDisabled}
                />

                <button
                  type="button"
                  onClick={handleCashOnDelivery}
                  disabled={codDisabled}
                  className="w-full rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {codLoading ? "Placing COD Order..." : "Place cash on delivery order"}
                </button>
              </div>

              {codHelperMessage ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {codHelperMessage}
                </div>
              ) : null}
              {onlineHelperMessage ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {onlineHelperMessage}
                </div>
              ) : null}
              {codError ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
                  {codError}
                </div>
              ) : null}
              <div className="mt-4 text-xs text-slate-500">
                Razorpay-secured checkout and server-verified totals.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
