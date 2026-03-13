import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchCategories, fetchSubCategories } from "../../redux/slices/category.js";
import { selectCurrentToken } from "../../redux/slices/Userslice.js";

const API_URL = import.meta.env.VITE_API_URL;

const createInitialForm = () => ({
  code: "",
  description: "",
  status: "ACTIVE",
  discountType: "PERCENTAGE",
  discountValue: 10,
  startDate: "",
  endDate: "",
  minimumCartAmount: 0,
  totalUsageLimit: 100,
  perUserUsageLimit: 1,
  maximumDiscountAmount: "",
  newCustomersOnly: false,
  allowedCategories: [],
  allowedSubCategories: [],
  excludedProducts: [],
  stackable: false,
  autoApply: false,
  firstOrderOnly: false,
  dailyUsageLimit: "",
  campaignTag: "",
});

const toLocalDateTimeInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const normalizeIdArray = (values = []) =>
  values.map((item) => String(item?._id || item)).filter(Boolean);

const couponToForm = (coupon) => ({
  code: coupon.code || "",
  description: coupon.description || "",
  status: coupon.status || "ACTIVE",
  discountType: coupon.discountType || "PERCENTAGE",
  discountValue: coupon.discountValue ?? 0,
  startDate: toLocalDateTimeInput(coupon.startDate),
  endDate: toLocalDateTimeInput(coupon.endDate),
  minimumCartAmount: coupon.minimumCartAmount ?? 0,
  totalUsageLimit: coupon.totalUsageLimit ?? 1,
  perUserUsageLimit: coupon.perUserUsageLimit ?? 1,
  maximumDiscountAmount:
    coupon.maximumDiscountAmount === null || coupon.maximumDiscountAmount === undefined
      ? ""
      : coupon.maximumDiscountAmount,
  newCustomersOnly: Boolean(coupon.newCustomersOnly),
  allowedCategories: normalizeIdArray(coupon.allowedCategories),
  allowedSubCategories: normalizeIdArray(coupon.allowedSubCategories),
  excludedProducts: normalizeIdArray(coupon.excludedProducts),
  stackable: Boolean(coupon.stackable),
  autoApply: Boolean(coupon.autoApply),
  firstOrderOnly: Boolean(coupon.firstOrderOnly),
  dailyUsageLimit:
    coupon.dailyUsageLimit === null || coupon.dailyUsageLimit === undefined
      ? ""
      : coupon.dailyUsageLimit,
  campaignTag: coupon.campaignTag || "",
});

const buildPayload = (form) => ({
  code: String(form.code || "").trim().toUpperCase(),
  description: form.description,
  status: form.status,
  discountType: form.discountType,
  discountValue: Number(form.discountValue),
  startDate: form.startDate ? new Date(form.startDate).toISOString() : "",
  endDate: form.endDate ? new Date(form.endDate).toISOString() : "",
  minimumCartAmount: Number(form.minimumCartAmount || 0),
  totalUsageLimit: Number(form.totalUsageLimit),
  perUserUsageLimit: Number(form.perUserUsageLimit),
  maximumDiscountAmount:
    form.maximumDiscountAmount === "" ? null : Number(form.maximumDiscountAmount),
  newCustomersOnly: Boolean(form.newCustomersOnly),
  allowedCategories: form.allowedCategories,
  allowedSubCategories: form.allowedSubCategories,
  excludedProducts: form.excludedProducts,
  stackable: Boolean(form.stackable),
  autoApply: Boolean(form.autoApply),
  firstOrderOnly: Boolean(form.firstOrderOnly),
  dailyUsageLimit: form.dailyUsageLimit === "" ? null : Number(form.dailyUsageLimit),
  campaignTag: form.campaignTag,
});

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}

export default function CouponManagement() {
  const dispatch = useDispatch();
  const token = useSelector(selectCurrentToken);
  const { categories, subCategories } = useSelector((state) => state.category);

  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(createInitialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [editingId, setEditingId] = useState(null);

  const filteredSubCategories = useMemo(() => {
    if (form.allowedCategories.length === 0) return subCategories;
    return subCategories.filter((sub) =>
      form.allowedCategories.includes(String(sub.category?._id || sub.category))
    );
  }, [form.allowedCategories, subCategories]);

  const loadCoupons = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/coupons/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load coupons");
      setCoupons(data.coupons || []);
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to load coupons" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(fetchCategories());
    dispatch(fetchSubCategories());
  }, [dispatch]);

  useEffect(() => {
    loadCoupons();
  }, [token]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleArrayValue = (key, value) => {
    setForm((prev) => {
      const exists = prev[key].includes(value);
      const nextValues = exists
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value];

      if (key === "allowedCategories") {
        const nextSubCategories = prev.allowedSubCategories.filter((subCategoryId) => {
          const subCategory = subCategories.find((item) => String(item._id) === subCategoryId);
          return subCategory && nextValues.includes(String(subCategory.category?._id || subCategory.category));
        });

        return {
          ...prev,
          allowedCategories: nextValues,
          allowedSubCategories: nextSubCategories,
        };
      }

      return { ...prev, [key]: nextValues };
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(createInitialForm());
  };

  const handleEdit = (coupon) => {
    setEditingId(coupon._id);
    setForm(couponToForm(coupon));
    setFeedback({ type: "", message: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    setFeedback({ type: "", message: "" });

    try {
      const payload = buildPayload(form);
      const endpoint = editingId
        ? `${API_URL}/coupons/admin/${editingId}`
        : `${API_URL}/coupons/admin`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save coupon");

      setFeedback({
        type: "success",
        message: editingId ? "Coupon updated successfully" : "Coupon created successfully",
      });
      resetForm();
      await loadCoupons();
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to save coupon" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (couponId) => {
    if (!token || !window.confirm("Delete this coupon?")) return;

    try {
      const res = await fetch(`${API_URL}/coupons/admin/${couponId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete coupon");

      setFeedback({ type: "success", message: "Coupon deleted successfully" });
      await loadCoupons();
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to delete coupon" });
    }
  };

  const handleQuickStatus = async (couponId, status) => {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/coupons/admin/${couponId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Failed to set coupon ${status.toLowerCase()}`);

      setFeedback({ type: "success", message: `Coupon marked ${status.toLowerCase()}` });
      await loadCoupons();
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to update coupon status" });
    }
  };

  return (
    <div className="space-y-6">
      {feedback.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Coupon Management</h3>
            <p className="mt-1 text-sm text-slate-600">
              Create and control coupon rules, category targeting, and usage limits.
            </p>
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Coupon Code">
            <input
              value={form.code}
              onChange={(e) => updateField("code", e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:border-slate-400"
              placeholder="WELCOME10"
              required
            />
          </Field>

          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="DELETED">Deleted</option>
            </select>
          </Field>

          <Field label="Discount Type">
            <select
              value={form.discountType}
              onChange={(e) => updateField("discountType", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_AMOUNT">Fixed Amount</option>
            </select>
          </Field>

          <Field label="Discount Value">
            <input
              type="number"
              min="0"
              value={form.discountValue}
              onChange={(e) => updateField("discountValue", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              required
            />
          </Field>

          <Field label="Start Date">
            <input
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => updateField("startDate", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              required
            />
          </Field>

          <Field label="End Date">
            <input
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => updateField("endDate", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              required
            />
          </Field>

          <Field label="Minimum Cart Amount">
            <input
              type="number"
              min="0"
              value={form.minimumCartAmount}
              onChange={(e) => updateField("minimumCartAmount", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </Field>

          <Field label="Maximum Discount">
            <input
              type="number"
              min="0"
              value={form.maximumDiscountAmount}
              onChange={(e) => updateField("maximumDiscountAmount", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="Optional"
            />
          </Field>

          <Field label="Total Usage Limit">
            <input
              type="number"
              min="1"
              value={form.totalUsageLimit}
              onChange={(e) => updateField("totalUsageLimit", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              required
            />
          </Field>

          <Field label="Per User Usage Limit">
            <input
              type="number"
              min="1"
              value={form.perUserUsageLimit}
              onChange={(e) => updateField("perUserUsageLimit", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              required
            />
          </Field>

          <Field label="Daily Usage Limit">
            <input
              type="number"
              min="1"
              value={form.dailyUsageLimit}
              onChange={(e) => updateField("dailyUsageLimit", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="Optional"
            />
          </Field>

          <Field label="Campaign Tag">
            <input
              value={form.campaignTag}
              onChange={(e) => updateField("campaignTag", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="SUMMER_SALE"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="Describe the coupon and internal usage notes"
            />
          </Field>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Allowed Categories</h4>
            <div className="grid max-h-56 grid-cols-1 gap-2 overflow-auto pr-1 sm:grid-cols-2">
              {categories.map((category) => (
                <CheckboxField
                  key={category._id}
                  label={category.name}
                  checked={form.allowedCategories.includes(String(category._id))}
                  onChange={() => toggleArrayValue("allowedCategories", String(category._id))}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Allowed Subcategories</h4>
            <div className="grid max-h-56 grid-cols-1 gap-2 overflow-auto pr-1 sm:grid-cols-2">
              {filteredSubCategories.map((subCategory) => (
                <CheckboxField
                  key={subCategory._id}
                  label={subCategory.name}
                  checked={form.allowedSubCategories.includes(String(subCategory._id))}
                  onChange={() => toggleArrayValue("allowedSubCategories", String(subCategory._id))}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CheckboxField
            label="New customers only"
            checked={form.newCustomersOnly}
            onChange={(e) => updateField("newCustomersOnly", e.target.checked)}
          />
          <CheckboxField
            label="Allow stacking"
            checked={form.stackable}
            onChange={(e) => updateField("stackable", e.target.checked)}
          />
          <CheckboxField
            label="Auto apply"
            checked={form.autoApply}
            onChange={(e) => updateField("autoApply", e.target.checked)}
          />
          <CheckboxField
            label="First order only"
            checked={form.firstOrderOnly}
            onChange={(e) => updateField("firstOrderOnly", e.target.checked)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : editingId ? "Update Coupon" : "Create Coupon"}
          </button>
        </div>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Existing Coupons</h3>
            <p className="text-sm text-slate-600">Pause, edit, or delete coupons from one place.</p>
          </div>
          <button
            type="button"
            onClick={loadCoupons}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Loading coupons...
          </div>
        ) : coupons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            No coupons created yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Code</th>
                  <th className="px-3 py-3 font-medium">Discount</th>
                  <th className="px-3 py-3 font-medium">Window</th>
                  <th className="px-3 py-3 font-medium">Usage</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon._id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-4">
                      <div className="font-semibold text-slate-900">{coupon.code}</div>
                      <div className="mt-1 text-xs text-slate-500">{coupon.description || "No description"}</div>
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {coupon.discountType === "PERCENTAGE"
                        ? `${coupon.discountValue}%`
                        : `Rs. ${coupon.discountValue}`}
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      <div>{new Date(coupon.startDate).toLocaleDateString()}</div>
                      <div className="text-xs text-slate-500">
                        to {new Date(coupon.endDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      <div>
                        {coupon.totalUsedCount || 0} / {coupon.totalUsageLimit}
                      </div>
                      <div className="text-xs text-slate-500">
                        per user {coupon.perUserUsageLimit}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          coupon.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : coupon.status === "PAUSED"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {coupon.status}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(coupon)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        {coupon.status !== "PAUSED" ? (
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(coupon._id, "PAUSED")}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                          >
                            Pause
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(coupon._id, "ACTIVE")}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(coupon._id)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
