import React, { useEffect, useMemo, useState } from "react";
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

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/api";

const emptyAddress = { fullName: "", mobileNumber: "", completeAddress: "", landmark: "", pincode: "", city: "", state: "" };
const emptyCouponState = { code: "", status: "idle", message: "", discount: 0, coupon: null, subtotal: null };

function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
    </div>
  );
}

function AddressSummary({ title, addr, onEdit, onMakeDefault, loading }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#f8fafc)] p-5 shadow-[0_20px_55px_-38px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-600">{title}</h4>
            {addr?.isDefault ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Default</span> : null}
          </div>
          {addr ? (
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">{addr.fullName}</div>
              <div className="text-slate-600">{addr.mobileNumber}</div>
              <div>{addr.completeAddress}</div>
              {addr.landmark ? <div className="text-slate-600">Landmark: {addr.landmark}</div> : null}
              <div className="text-slate-600">{addr.city}, {addr.state} - {addr.pincode}</div>
            </div>
          ) : <div className="mt-2 text-sm text-slate-500">No address saved yet.</div>}
        </div>
        <div className="flex flex-col gap-2">
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
  return parts.join(" • ");
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
    <div className="rounded-[24px] border border-emerald-100 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(180deg,_#ffffff,_#f0fdf4)] p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-700">
            Available Coupons
          </div>
          <h4 className="mt-1 text-lg font-semibold text-slate-900">
            Pick an offer for this checkout
          </h4>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
          {loading ? "Loading..." : `${coupons.length} live`}
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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                    {coupon.code}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatCouponPrimaryText(coupon)}
                  </p>
                  {coupon.description ? (
                    <p className="mt-1 text-xs leading-5 text-slate-600">{coupon.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(coupon.code)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
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
          No active coupons available right now.
        </div>
      )}
    </div>
  );
}

export default function CheckoutAddresses() {
  const dispatch = useDispatch();
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

  const isEditing = useMemo(() => mode.startsWith("edit"), [mode]);
  const normalizedCouponCode = useMemo(() => String(couponCode || "").trim().toUpperCase(), [couponCode]);
  const isCouponApplied = couponState.status === "applied" && couponState.code === normalizedCouponCode;
  const checkoutDisabled = !deliverySaved || !billingSaved || cartItems.length === 0;
  const effectiveSubtotal = Number(pricingPreview?.subtotal ?? cartSummary.subtotal ?? 0);
  const effectiveShipping = Number(pricingPreview?.shipping ?? 0);
  const effectiveDiscount = Number(pricingPreview?.discount ?? couponState.discount ?? 0);
  const effectiveTotal = Number(pricingPreview?.total ?? Math.max(0, effectiveSubtotal + effectiveShipping - effectiveDiscount));

  useEffect(() => {
    dispatch(fetchMyAddresses());
    dispatch(getCart());
    return () => dispatch(resetAddressState());
  }, [dispatch]);

  useEffect(() => {
    if (deliverySaved) setDelivery((prev) => ({ ...prev, fullName: deliverySaved.fullName || "", mobileNumber: deliverySaved.mobileNumber || "", completeAddress: deliverySaved.completeAddress || "", landmark: deliverySaved.landmark || "", pincode: deliverySaved.pincode || "", city: deliverySaved.city || "", state: deliverySaved.state || "" }));
    if (billingSaved) setBilling((prev) => ({ ...prev, fullName: billingSaved.fullName || "", mobileNumber: billingSaved.mobileNumber || "", completeAddress: billingSaved.completeAddress || "", landmark: billingSaved.landmark || "", pincode: billingSaved.pincode || "", city: billingSaved.city || "", state: billingSaved.state || "" }));
  }, [deliverySaved, billingSaved]);

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
      try {
        setLoadingCoupons(true);
        const res = await fetch(`${API_URL}/coupons/active`);
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

  const headerTitle = mode === "edit-delivery" ? "Edit Delivery Address" : mode === "edit-billing" ? "Edit Billing Address" : "Delivery & Billing Address";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#eef6ff_0%,_#f8fafc_24%,_#ffffff_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
        <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.15),_transparent_24%),linear-gradient(135deg,_#0f172a,_#1e293b_48%,_#0f766e)] px-6 py-8 text-white shadow-[0_36px_90px_-44px_rgba(15,23,42,0.55)] md:px-10 md:py-10">
          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-100">Secure Checkout</div>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">Finish your order with a checkout that actually feels premium.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 md:text-base">Save addresses, unlock offers, and pay from a backend-verified total. The page is organized to make the final step feel confident, not cluttered.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur"><div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Items</div><div className="mt-1 text-2xl font-semibold">{cartItems.length}</div></div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur"><div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Saved</div><div className="mt-1 text-2xl font-semibold text-emerald-300">Rs. {effectiveDiscount.toFixed(0)}</div></div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur"><div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Total</div><div className="mt-1 text-2xl font-semibold">Rs. {effectiveTotal.toFixed(0)}</div></div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <SectionHeader eyebrow="Address Center" title={headerTitle} description="Add your delivery and billing addresses here. Keep them the same for speed, or edit them independently when you need more control." />
            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            {success && message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <AddressSummary title="Delivery" addr={deliverySaved} loading={loading} onEdit={() => setMode("edit-delivery")} onMakeDefault={() => onMakeDefault(deliverySaved._id)} />
              <AddressSummary title="Billing" addr={billingSaved} loading={loading} onEdit={() => setMode("edit-billing")} onMakeDefault={() => onMakeDefault(billingSaved._id)} />
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] md:p-7">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div>
                  <SectionHeader eyebrow="Delivery" title="Delivery Information" description="Use the address where the order should actually reach." />
                  <div className="mt-5 grid grid-cols-1 gap-4">
                    <Input label="Full Name" value={delivery.fullName} onChange={(value) => handleChange("delivery", "fullName", value)} placeholder="Enter full name" />
                    <Input label="Mobile Number" value={delivery.mobileNumber} onChange={(value) => handleChange("delivery", "mobileNumber", value)} placeholder="Enter mobile number" type="tel" />
                    <TextArea label="Complete Address" value={delivery.completeAddress} onChange={(value) => handleChange("delivery", "completeAddress", value)} placeholder="House no, street, area..." />
                    <Input label="Landmark (optional)" value={delivery.landmark} onChange={(value) => handleChange("delivery", "landmark", value)} placeholder="Near ..." />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input label="Pincode" value={delivery.pincode} onChange={(value) => handleChange("delivery", "pincode", value)} placeholder="6-digit pincode" />
                      <Input label="City" value={delivery.city} onChange={(value) => handleChange("delivery", "city", value)} placeholder="City" />
                    </div>
                    <Input label="State" value={delivery.state} onChange={(value) => handleChange("delivery", "state", value)} placeholder="State" />
                  </div>
                </div>

                <div>
                  <SectionHeader eyebrow="Billing" title="Billing Information" description="Use this if billing details differ from delivery." />
                  <label className="mt-5 flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" className="h-4 w-4" checked={sameAsDelivery} onChange={(e) => setSameAsDelivery(e.target.checked)} disabled={mode === "edit-billing"} />
                    Same as delivery address
                  </label>
                  <div className={`mt-4 grid grid-cols-1 gap-4 ${sameAsDelivery ? "opacity-60" : ""}`}>
                    <Input label="Full Name" value={billing.fullName} onChange={(value) => handleChange("billing", "fullName", value)} placeholder="Enter full name" />
                    <Input label="Mobile Number" value={billing.mobileNumber} onChange={(value) => handleChange("billing", "mobileNumber", value)} placeholder="Enter mobile number" type="tel" />
                    <TextArea label="Complete Address" value={billing.completeAddress} onChange={(value) => handleChange("billing", "completeAddress", value)} placeholder="House no, street, area..." />
                    <Input label="Landmark (optional)" value={billing.landmark} onChange={(value) => handleChange("billing", "landmark", value)} placeholder="Near ..." />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input label="Pincode" value={billing.pincode} onChange={(value) => handleChange("billing", "pincode", value)} placeholder="6-digit pincode" />
                      <Input label="City" value={billing.city} onChange={(value) => handleChange("billing", "city", value)} placeholder="City" />
                    </div>
                    <Input label="State" value={billing.state} onChange={(value) => handleChange("billing", "state", value)} placeholder="State" />
                  </div>
                  <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" className="h-4 w-4" checked={setAsDefault} onChange={(e) => setSetAsDefault(e.target.checked)} />
                    Set as default address
                  </label>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{isEditing ? "Updating an existing address" : "You can save both delivery and billing together"}</div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <button onClick={() => setMode("create")} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">Cancel</button>
                      <button disabled={loading} onClick={onUpdate} className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{loading ? "Updating..." : "Update"}</button>
                    </>
                  ) : (
                    <button disabled={loading} onClick={onSave} className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{loading ? "Saving..." : "Save Addresses"}</button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="xl:sticky xl:top-6 xl:self-start">
            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white/90 shadow-[0_30px_80px_-44px_rgba(15,23,42,0.45)] backdrop-blur">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#0f172a,_#1e293b_48%,_#0f766e)] px-6 py-8 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-300">Final Step</div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Offers, totals, and payment</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-200">Apply your coupon, review the total, and pay from a secure backend-generated order. Sale-item eligibility depends on the selected coupon rule.</p>
              </div>

              <div className="space-y-5 px-6 py-6">
                <CouponCelebration visible={showCouponCelebration || (isCouponApplied && effectiveDiscount > 0)} code={normalizedCouponCode} discount={effectiveDiscount} />

                <AvailableCoupons
                  coupons={availableCoupons}
                  loading={loadingCoupons}
                  copiedCouponCode={copiedCouponCode}
                  onCopy={handleCopyCoupon}
                />

                <div className="rounded-[24px] border border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.10),_transparent_28%),linear-gradient(180deg,_#ffffff,_#f8fafc)] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div><div className="text-xs font-semibold uppercase tracking-[0.26em] text-sky-700">Coupon</div><h4 className="mt-1 text-lg font-semibold text-slate-900">Enter a promo code</h4></div>
                    {isCouponApplied ? <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Applied</div> : null}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Coupon Code</label>
                      <input type="text" value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); if (couponState.status !== "idle") resetCouponFeedback(); }} placeholder="ENTER CODE" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium uppercase tracking-[0.22em] text-slate-900 outline-none transition duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleValidateCoupon} disabled={!normalizedCouponCode || couponState.status === "validating"} className="flex-1 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:opacity-60">{couponState.status === "validating" ? "Checking..." : "Apply"}</button>
                      {(normalizedCouponCode || isCouponApplied) ? <button type="button" onClick={handleRemoveCoupon} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">Remove</button> : null}
                    </div>
                  </div>
                  {couponState.message && couponState.status !== "applied" ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{couponState.message}</div> : null}
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div><div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">Summary</div><h4 className="mt-1 text-lg font-semibold text-slate-900">Payment breakdown</h4></div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Backend synced</div>
                  </div>
                  <div className="space-y-3">
                    <PriceRow label="Cart Items" value={String(cartItems.length)} />
                    <PriceRow label="Subtotal" value={`Rs. ${effectiveSubtotal.toFixed(2)}`} />
                    <PriceRow label="Shipping" value={effectiveShipping === 0 ? "FREE" : `Rs. ${effectiveShipping.toFixed(2)}`} />
                    <PriceRow label="Coupon Discount" value={effectiveDiscount > 0 ? `- Rs. ${effectiveDiscount.toFixed(2)}` : "Rs. 0.00"} valueClassName="font-semibold text-emerald-700" />
                    <div className="border-t border-dashed border-slate-200 pt-3">
                      <div className="flex items-center justify-between text-lg font-semibold text-slate-900"><span>Payable Total</span><span>Rs. {effectiveTotal.toFixed(2)}</span></div>
                      <p className="mt-1 text-xs text-slate-500">Final amount is revalidated by the server before payment starts.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#f8fafc)] p-5 shadow-sm">
                  <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Secure payment</div>
                  <h3 className="mt-3 text-xl font-semibold text-slate-900">Complete your order</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Pay securely using Razorpay after saving your addresses. Applied offers are locked into the server-side order amount.</p>
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-600"><span>Order total</span><span className="text-base font-semibold text-slate-900">Rs. {effectiveTotal.toFixed(2)}</span></div>
                    {isCouponApplied ? <div className="mt-3 flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2 text-sm"><span className="font-medium text-emerald-700">{normalizedCouponCode}</span><span className="font-semibold text-emerald-700">Saved Rs. {effectiveDiscount.toFixed(2)}</span></div> : null}
                  </div>
                  <div className="mt-5">
                    <RazorpayPayNow token={token} couponCode={isCouponApplied ? normalizedCouponCode : ""} onSuccess={({ orderId }) => console.log("Paid order:", orderId)} onOrderCreated={handleOrderCreated} disabled={checkoutDisabled} />
                  </div>
                  <div className="mt-5 space-y-3 text-xs text-slate-500">
                    <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Razorpay-secured checkout</div>
                    <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-500" />Coupon logic never runs on the client</div>
                    <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />Payment total is locked from the backend</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  Tip: Save your addresses first, then apply a coupon and complete payment from the locked total shown above.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
