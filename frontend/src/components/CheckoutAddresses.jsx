// src/components/CheckoutAddresses.jsx
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

const emptyAddress = {
  fullName: "",
  mobileNumber: "",
  completeAddress: "",
  landmark: "",
  pincode: "",
  city: "",
  state: "",
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
            <div className="mt-2 text-sm text-slate-700 space-y-1">
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

export default function CheckoutAddresses() {
  const dispatch = useDispatch();

  const deliverySaved = useSelector(selectDeliveryAddress);
  const billingSaved = useSelector(selectBillingAddress);
  const loading = useSelector(selectAddressLoading);
  const error = useSelector(selectAddressError);
  const success = useSelector(selectAddressSuccess);
  const message = useSelector(selectAddressMessage);

  const [sameAsDelivery, setSameAsDelivery] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(true);

  const [mode, setMode] = useState("create"); // create | edit-delivery | edit-billing

  const [delivery, setDelivery] = useState(emptyAddress);
  const [billing, setBilling] = useState(emptyAddress);

  const isEditing = useMemo(() => mode.startsWith("edit"), [mode]);

  useEffect(() => {
    dispatch(fetchMyAddresses());
    return () => {
      dispatch(resetAddressState());
    };
  }, [dispatch]);

  useEffect(() => {
    // Prefill forms from saved addresses when available
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sameAsDelivery]);

  const handleChange = (which, key, value) => {
    if (which === "delivery") {
      setDelivery((prev) => ({ ...prev, [key]: value }));
      if (sameAsDelivery) {
        setBilling((prev) => ({ ...prev, [key]: value }));
      }
    } else {
      setBilling((prev) => ({ ...prev, [key]: value }));
    }
  };

  const validateLocal = (addr) => {
    const required = ["fullName", "mobileNumber", "completeAddress", "pincode", "city", "state"];
    for (const f of required) {
      if (!addr[f] || String(addr[f]).trim() === "") return `Please fill ${f}`;
    }
    return null;
  };

  const onSave = async () => {
    const dErr = validateLocal(delivery);
    if (dErr) return alert(dErr);

    if (!sameAsDelivery) {
      const bErr = validateLocal(billing);
      if (bErr) return alert(bErr);
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
      const dErr = validateLocal(delivery);
      if (dErr) return alert(dErr);

      await dispatch(updateAddress({ id: deliverySaved._id, updates: delivery }));
      dispatch(fetchMyAddresses());
      setMode("create");
      return;
    }

    if (mode === "edit-billing") {
      if (!billingSaved?._id) return;
      const bErr = validateLocal(billing);
      if (bErr) return alert(bErr);

      await dispatch(updateAddress({ id: billingSaved._id, updates: billing }));
      dispatch(fetchMyAddresses());
      setMode("create");
    }
  };

  const onMakeDefault = async (addrId) => {
    await dispatch(setDefaultAddress(addrId));
    dispatch(fetchMyAddresses());
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

        {/* Alerts */}
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

        {/* Saved summaries */}
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

        {/* Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Delivery */}
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
                  onChange={(v) => handleChange("delivery", "fullName", v)}
                  placeholder="Enter full name"
                />
                <Input
                  label="Mobile Number"
                  value={delivery.mobileNumber}
                  onChange={(v) => handleChange("delivery", "mobileNumber", v)}
                  placeholder="Enter mobile number"
                  type="tel"
                />
                <TextArea
                  label="Complete Address"
                  value={delivery.completeAddress}
                  onChange={(v) => handleChange("delivery", "completeAddress", v)}
                  placeholder="House no, street, area..."
                />
                <Input
                  label="Landmark (optional)"
                  value={delivery.landmark}
                  onChange={(v) => handleChange("delivery", "landmark", v)}
                  placeholder="Near ..."
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Pincode"
                    value={delivery.pincode}
                    onChange={(v) => handleChange("delivery", "pincode", v)}
                    placeholder="6-digit pincode"
                  />
                  <Input
                    label="City"
                    value={delivery.city}
                    onChange={(v) => handleChange("delivery", "city", v)}
                    placeholder="City"
                  />
                </div>
                <Input
                  label="State"
                  value={delivery.state}
                  onChange={(v) => handleChange("delivery", "state", v)}
                  placeholder="State"
                />
              </div>
            </div>

            {/* Billing */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Billing Information</h3>
                {mode === "edit-billing" ? (
                  <span className="text-xs font-medium text-slate-500">Editing</span>
                ) : null}
              </div>

              {/* Same as delivery */}
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
                  onChange={(v) => handleChange("billing", "fullName", v)}
                  placeholder="Enter full name"
                  // lock when same
                />
                <Input
                  label="Mobile Number"
                  value={billing.mobileNumber}
                  onChange={(v) => handleChange("billing", "mobileNumber", v)}
                  placeholder="Enter mobile number"
                  type="tel"
                />
                <TextArea
                  label="Complete Address"
                  value={billing.completeAddress}
                  onChange={(v) => handleChange("billing", "completeAddress", v)}
                  placeholder="House no, street, area..."
                />
                <Input
                  label="Landmark (optional)"
                  value={billing.landmark}
                  onChange={(v) => handleChange("billing", "landmark", v)}
                  placeholder="Near ..."
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Pincode"
                    value={billing.pincode}
                    onChange={(v) => handleChange("billing", "pincode", v)}
                    placeholder="6-digit pincode"
                  />
                  <Input
                    label="City"
                    value={billing.city}
                    onChange={(v) => handleChange("billing", "city", v)}
                    placeholder="City"
                  />
                </div>
                <Input
                  label="State"
                  value={billing.state}
                  onChange={(v) => handleChange("billing", "state", v)}
                  placeholder="State"
                />
              </div>

              {/* Default */}
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

          {/* Actions */}
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

        {/* Small note */}
        <div className="mt-4 text-xs text-slate-500">
          Tip: After saving, use the “Make default” button in the summary cards if you want to switch defaults quickly.
        </div>
      </div>
    </div>
  );
}
