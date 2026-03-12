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
import {
  getCart,
  selectCartItems,
  selectCartSummary,
} from "../redux/slices/Cartslice.js";
import { selectCurrentToken } from "../redux/slices/Userslice.js";
import RazorpayPayNow from "../components/RazorpayPayNow.jsx";

const API_URL = import.meta.env.VITE_API_URL;

const emptyAddress = {
  fullName: "",
  mobileNumber: "",
  completeAddress: "",
  landmark: "",
  pincode: "",
  city: "",
  state: "",
};

const emptyCouponState = {
  code: "",
  status: "idle",
  message: "",
  discount: 0,
  coupon: null,
  subtotal: null,
};

function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400"
      />
    </div>
  );
}

function AddressSummary({ title, addr, onEdit, onMakeDefault, loading }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
            {addr?.isDefault ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Default
              </span>
            ) : null}
          </div>
          {addr ? (
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <div className="font-medium text-slate-900">{addr.fullName}</div>
              <div className="text-slate-600">{addr.mobileNumber}</div>
              <div>{addr.completeAddress}</div>
              {addr.landmark ? <div className="text-slate-600">Landmark: {addr.landmark}</div> : null}
              <div className="text-slate-600">
                {addr.city}, {addr.state} - {addr.pincode}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-500">No address saved yet.</div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onEdit}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Edit
          </button>
          {addr?._id && !addr?.isDefault ? (
            <button
              disabled={loading}
              onClick={onMakeDefault}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Make default
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PriceRow({ label, value, valueClassName = "font-medium text-slate-900" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={valueClassName}>{value}</span>
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

  const isEditing = useMemo(() => mode.startsWith("edit"), [mode]);
  const normalizedCouponCode = useMemo(
    () => String(couponCode || "").trim().toUpperCase(),
    [couponCode]
  );
  const isCouponApplied =
    couponState.status === "applied" && couponState.code === normalizedCouponCode;
  const checkoutDisabled = !deliverySaved || !billingSaved || cartItems.length === 0;

  const effectiveSubtotal = Number(pricingPreview?.subtotal ?? cartSummary.subtotal ?? 0);
  const effectiveShipping = Number(pricingPreview?.shipping ?? 0);
  const effectiveDiscount = Number(pricingPreview?.discount ?? couponState.discount ?? 0);
  const effectiveTotal = Number(
    pricingPreview?.total ??
      Math.max(0, effectiveSubtotal + effectiveShipping - effectiveDiscount)
  );

  useEffect(() => {
    dispatch(fetchMyAddresses());
    dispatch(getCart());

    return () => {
      dispatch(resetAddressState());
    };
  }, [dispatch]);

  useEffect(() => {
    if (deliverySaved) {
      setDelivery((prev) => ({
        ...prev,
        fullName: deliverySaved.fullName || "",
        mobileNumber: deliverySaved.mobileNumber || "",
        completeAddress: deliverySaved.completeAddress || "",
        landmark: deliverySaved.landmark || "",
        pincode: deliverySaved.pincode || "",
        city: deliverySaved.city || "",
        state: deliverySaved.state || "",
      }));
    }
    if (billingSaved) {
      setBilling((prev) => ({
        ...prev,
        fullName: billingSaved.fullName || "",
        mobileNumber: billingSaved.mobileNumber || "",
        completeAddress: billingSaved.completeAddress || "",
        landmark: billingSaved.landmark || "",
        pincode: billingSaved.pincode || "",
        city: billingSaved.city || "",
        state: billingSaved.state || "",
      }));
    }
  }, [deliverySaved, billingSaved]);

  useEffect(() => {
    if (sameAsDelivery) {
      setBilling((prev) => ({
        ...prev,
        ...delivery,
      }));
    }
  }, [delivery, sameAsDelivery]);

  const handleChange = (which, key, value) => {
    if (which === "delivery") {
      setDelivery((prev) => ({ ...prev, [key]: value }));
      if (sameAsDelivery) {
        setBilling((prev) => ({ ...prev, [key]: value }));
      }
      return;
    }

    setBilling((prev) => ({ ...prev, [key]: value }));
  };

  const validateLocal = (addr) => {
    const required = ["fullName", "mobileNumber", "completeAddress", "pincode", "city", "state"];
    for (const field of required) {
      if (!addr[field] || String(addr[field]).trim() === "") {
        return `Please fill ${field}`;
      }
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

    await dispatch(
      upsertDeliveryBilling({
        sameAsDelivery,
        setAsDefault,
        delivery,
        ...(sameAsDelivery ? {} : { billing }),
      })
    );

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

  const handlePaymentSuccess = ({ orderId }) => {
    console.log("Paid order:", orderId);
  };

  const resetCouponFeedback = () => {
    setCouponState(emptyCouponState);
    setPricingPreview(null);
  };

  const handleValidateCoupon = async () => {
    if (!token) return;

    if (!normalizedCouponCode) {
      setCouponState({
        ...emptyCouponState,
        status: "error",
        message: "Enter a coupon code",
      });
      setPricingPreview(null);
      return;
    }

    setCouponState((prev) => ({
      ...prev,
      code: normalizedCouponCode,
      status: "validating",
      message: "",
    }));

    try {
      const res = await fetch(`${API_URL}/coupons/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ couponCode: normalizedCouponCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to validate coupon");
      }

      const subtotal = Number(data.subtotal || cartSummary.subtotal || 0);
      const shipping = 0;
      const discount = Number(data.discount || 0);

      setCouponState({
        code: normalizedCouponCode,
        status: "applied",
        message: "Coupon applied",
        discount,
        coupon: data.coupon || null,
        subtotal,
      });
      setPricingPreview({
        subtotal,
        shipping,
        discount,
        total: Math.max(0, subtotal + shipping - discount),
        coupon: data.coupon || null,
      });
    } catch (validationError) {
      setCouponState({
        ...emptyCouponState,
        code: normalizedCouponCode,
        status: "error",
        message: validationError.message || "Failed to validate coupon",
      });
      setPricingPreview(null);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode("");
    resetCouponFeedback();
  };

  const handleOrderCreated = (created) => {
    const pricing = created?.pricing;
    if (!pricing) return;

    setPricingPreview({
      subtotal: Number(pricing.subtotal || 0),
      shipping: Number(pricing.shipping || 0),
      discount: Number(pricing.discount || 0),
      total: Number(pricing.total || 0),
      coupon: pricing.coupon || null,
    });
  };

  const headerTitle =
    mode === "edit-delivery"
      ? "Edit Delivery Address"
      : mode === "edit-billing"
        ? "Edit Billing Address"
        : "Delivery & Billing Address";

  return (
    <div className="w-full bg-slate-50">
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-900">{headerTitle}</h2>
          <p className="text-sm text-slate-600">
            Add your delivery address and billing address. You can keep billing same as delivery.
          </p>
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

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
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

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Delivery Information</h3>
                {mode === "edit-delivery" ? (
                  <span className="text-xs font-medium text-slate-500">Editing</span>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Input
                  label="Full Name"
                  value={delivery.fullName}
                  onChange={(value) => handleChange("delivery", "fullName", value)}
                  placeholder="Enter full name"
                />
                <Input
                  label="Mobile Number"
                  value={delivery.mobileNumber}
                  onChange={(value) => handleChange("delivery", "mobileNumber", value)}
                  placeholder="Enter mobile number"
                  type="tel"
                />
                <TextArea
                  label="Complete Address"
                  value={delivery.completeAddress}
                  onChange={(value) => handleChange("delivery", "completeAddress", value)}
                  placeholder="House no, street, area..."
                />
                <Input
                  label="Landmark (optional)"
                  value={delivery.landmark}
                  onChange={(value) => handleChange("delivery", "landmark", value)}
                  placeholder="Near ..."
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Pincode"
                    value={delivery.pincode}
                    onChange={(value) => handleChange("delivery", "pincode", value)}
                    placeholder="6-digit pincode"
                  />
                  <Input
                    label="City"
                    value={delivery.city}
                    onChange={(value) => handleChange("delivery", "city", value)}
                    placeholder="City"
                  />
                </div>
                <Input
                  label="State"
                  value={delivery.state}
                  onChange={(value) => handleChange("delivery", "state", value)}
                  placeholder="State"
                />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Billing Information</h3>
                {mode === "edit-billing" ? (
                  <span className="text-xs font-medium text-slate-500">Editing</span>
                ) : null}
              </div>

              <label className="mb-4 flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={sameAsDelivery}
                  onChange={(e) => setSameAsDelivery(e.target.checked)}
                  disabled={mode === "edit-billing"}
                />
                Same as delivery address
              </label>

              <div className={`grid grid-cols-1 gap-3 ${sameAsDelivery ? "opacity-60" : ""}`}>
                <Input
                  label="Full Name"
                  value={billing.fullName}
                  onChange={(value) => handleChange("billing", "fullName", value)}
                  placeholder="Enter full name"
                />
                <Input
                  label="Mobile Number"
                  value={billing.mobileNumber}
                  onChange={(value) => handleChange("billing", "mobileNumber", value)}
                  placeholder="Enter mobile number"
                  type="tel"
                />
                <TextArea
                  label="Complete Address"
                  value={billing.completeAddress}
                  onChange={(value) => handleChange("billing", "completeAddress", value)}
                  placeholder="House no, street, area..."
                />
                <Input
                  label="Landmark (optional)"
                  value={billing.landmark}
                  onChange={(value) => handleChange("billing", "landmark", value)}
                  placeholder="Near ..."
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Pincode"
                    value={billing.pincode}
                    onChange={(value) => handleChange("billing", "pincode", value)}
                    placeholder="6-digit pincode"
                  />
                  <Input
                    label="City"
                    value={billing.city}
                    onChange={(value) => handleChange("billing", "city", value)}
                    placeholder="City"
                  />
                </div>
                <Input
                  label="State"
                  value={billing.state}
                  onChange={(value) => handleChange("billing", "state", value)}
                  placeholder="State"
                />
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
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              {isEditing ? "You are updating an existing address." : "You can save both delivery & billing together."}
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setMode("create")}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={loading}
                    onClick={onUpdate}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {loading ? "Updating..." : "Update"}
                  </button>
                </>
              ) : (
                <button
                  disabled={loading}
                  onClick={onSave}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {loading ? "Saving..." : "Save Addresses"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Coupon Code
                  </label>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      if (couponState.status !== "idle") {
                        resetCouponFeedback();
                      }
                    }}
                    placeholder="Enter coupon code"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm uppercase outline-none transition focus:border-slate-400"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleValidateCoupon}
                    disabled={!normalizedCouponCode || couponState.status === "validating"}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {couponState.status === "validating" ? "Checking..." : "Apply"}
                  </button>
                  {(normalizedCouponCode || isCouponApplied) && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {couponState.message ? (
                <div
                  className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                    couponState.status === "applied"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  {couponState.message}
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                <PriceRow label="Cart Items" value={String(cartItems.length)} />
                <PriceRow label="Subtotal" value={`Rs. ${effectiveSubtotal.toFixed(2)}`} />
                <PriceRow
                  label="Shipping"
                  value={
                    effectiveShipping === 0 ? "FREE" : `Rs. ${effectiveShipping.toFixed(2)}`
                  }
                />
                <PriceRow
                  label="Coupon Discount"
                  value={effectiveDiscount > 0 ? `- Rs. ${effectiveDiscount.toFixed(2)}` : "Rs. 0.00"}
                  valueClassName="font-medium text-emerald-700"
                />
                <div className="border-t border-slate-200 pt-2">
                  <div className="flex items-center justify-between text-base font-semibold text-slate-900">
                    <span>Payable Total</span>
                    <span>Rs. {effectiveTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900">Payment</h3>
            <p className="mt-1 text-sm text-slate-600">
              Pay securely using Razorpay after saving your addresses.
            </p>

            <div className="mt-5">
              <RazorpayPayNow
                token={token}
                couponCode={isCouponApplied ? normalizedCouponCode : ""}
                onSuccess={handlePaymentSuccess}
                onOrderCreated={handleOrderCreated}
                disabled={checkoutDisabled}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Tip: After saving addresses, use the "Make default" button in the summary cards if you want to switch defaults quickly.
        </div>
      </div>
    </div>
  );
}
