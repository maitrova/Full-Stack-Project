import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchCategories } from "../../redux/slices/category.js";
import { selectCurrentToken } from "../../redux/slices/Userslice.js";

const API_URL = import.meta.env.VITE_API_URL;

const createTier = (minCartAmount = "", discountValue = "") => ({
  minCartAmount,
  discountType: "PERCENTAGE",
  discountValue,
  maximumDiscountAmount: "",
});

const createInitialForm = () => ({
  name: "",
  description: "",
  status: "ACTIVE",
  startDate: "",
  endDate: "",
  priority: 0,
  tiers: [createTier(999, 5), createTier(1999, 10)],
  allowedCategories: [],
  excludedProducts: [],
  includeComboPacks: false,
  includeSaleItems: true,
  stackWithCoupons: true,
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

const ruleToForm = (rule) => ({
  name: rule.name || "",
  description: rule.description || "",
  status: rule.status || "ACTIVE",
  startDate: toLocalDateTimeInput(rule.startDate),
  endDate: toLocalDateTimeInput(rule.endDate),
  priority: rule.priority ?? 0,
  tiers: (rule.tiers || []).map((tier) => ({
    minCartAmount: tier.minCartAmount ?? "",
    discountType: tier.discountType || "PERCENTAGE",
    discountValue: tier.discountValue ?? "",
    maximumDiscountAmount: tier.maximumDiscountAmount ?? "",
  })),
  allowedCategories: (rule.allowedCategories || []).map(String),
  excludedProducts: (rule.excludedProducts || []).map(String),
  includeComboPacks: Boolean(rule.includeComboPacks),
  includeSaleItems: rule.includeSaleItems !== false,
  stackWithCoupons: rule.stackWithCoupons !== false,
});

const describeTier = (tier) =>
  tier.discountType === "PERCENTAGE"
    ? `${tier.discountValue}% off${tier.maximumDiscountAmount ? ` (max Rs.${tier.maximumDiscountAmount})` : ""}`
    : `Rs.${tier.discountValue} off`;

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN") : "—");

const CartOfferRulesManager = () => {
  const dispatch = useDispatch();
  const token = useSelector(selectCurrentToken);
  const { categories = [] } = useSelector((state) => state.category);

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchRules = async () => {
    const res = await fetch(`${API_URL}/cart-offers/admin`, { headers: authHeaders });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load offers");
    return Array.isArray(data.rules) ? data.rules : [];
  };

  const loadRules = () =>
    fetchRules()
      .then(setRules)
      .catch((error) => setMessage({ type: "error", text: error.message }))
      .finally(() => setLoading(false));

  useEffect(() => {
    dispatch(fetchCategories());
    fetchRules()
      .then(setRules)
      .catch((error) => setMessage({ type: "error", text: error.message }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateTier = (index, key, value) =>
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, [key]: value } : tier)),
    }));

  const toggleCategory = (categoryId) =>
    setForm((prev) => ({
      ...prev,
      allowedCategories: prev.allowedCategories.includes(categoryId)
        ? prev.allowedCategories.filter((id) => id !== categoryId)
        : [...prev.allowedCategories, categoryId],
    }));

  const openCreate = () => {
    setEditingId(null);
    setForm(createInitialForm());
    setShowForm(true);
    setMessage({ type: "", text: "" });
  };

  const openEdit = (rule) => {
    setEditingId(rule._id);
    setForm(ruleToForm(rule));
    setShowForm(true);
    setMessage({ type: "", text: "" });
  };

  const buildPayload = (source) => ({
    ...source,
    startDate: source.startDate ? new Date(source.startDate).toISOString() : null,
    endDate: source.endDate ? new Date(source.endDate).toISOString() : null,
    priority: Number(source.priority || 0),
    tiers: source.tiers.map((tier) => ({
      minCartAmount: Number(tier.minCartAmount),
      discountType: tier.discountType,
      discountValue: Number(tier.discountValue),
      maximumDiscountAmount: tier.maximumDiscountAmount === "" ? null : Number(tier.maximumDiscountAmount),
    })),
  });

  const saveRule = async (payload, id = editingId) => {
    const res = await fetch(`${API_URL}/cart-offers/admin${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to save offer");
    return data;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      await saveRule(buildPayload(form));
      setMessage({ type: "success", text: editingId ? "Offer updated" : "Offer created" });
      setShowForm(false);
      await loadRules();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (rule) => {
    try {
      const nextForm = { ...ruleToForm(rule), status: rule.status === "ACTIVE" ? "PAUSED" : "ACTIVE" };
      await saveRule(buildPayload(nextForm), rule._id);
      await loadRules();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const deleteRule = async (rule) => {
    if (!window.confirm(`Delete "${rule.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/cart-offers/admin/${rule._id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete offer");
      await loadRules();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Cart Value Offers</h2>
          <p className="text-sm text-slate-600">
            "Spend Rs.X, get Y off" rules. Customers see how much more they need to add in their cart.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New offer
        </button>
      </div>

      {message.text ? (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{editingId ? "Edit offer" : "New offer"}</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Offer name *</span>
              <input className={inputClass} value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Spend more, save more" required />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Status</span>
              <select className={inputClass} value={form.status} onChange={(e) => updateField("status", e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Description (shown to customers)</span>
              <input className={inputClass} value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Bigger cart, bigger savings" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Starts (optional)</span>
              <input type="datetime-local" className={inputClass} value={form.startDate} onChange={(e) => updateField("startDate", e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Ends (optional)</span>
              <input type="datetime-local" className={inputClass} value={form.endDate} onChange={(e) => updateField("endDate", e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Priority</span>
              <input type="number" className={inputClass} value={form.priority} onChange={(e) => updateField("priority", e.target.value)} />
              <span className="mt-1 block text-xs text-slate-500">Used only when two offers give the same discount.</span>
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Cart value tiers *</span>
              <button
                type="button"
                onClick={() => updateField("tiers", [...form.tiers, createTier()])}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                + Add tier
              </button>
            </div>
            <div className="space-y-2">
              {form.tiers.map((tier, index) => (
                <div key={index} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-5 sm:items-end">
                  <label className="block text-xs">
                    <span className="mb-1 block text-slate-600">Cart value ≥ (Rs.)</span>
                    <input type="number" min="1" className={inputClass} value={tier.minCartAmount} onChange={(e) => updateTier(index, "minCartAmount", e.target.value)} required />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block text-slate-600">Discount type</span>
                    <select className={inputClass} value={tier.discountType} onChange={(e) => updateTier(index, "discountType", e.target.value)}>
                      <option value="PERCENTAGE">% off</option>
                      <option value="FIXED_AMOUNT">Flat Rs. off</option>
                    </select>
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block text-slate-600">{tier.discountType === "PERCENTAGE" ? "Percent" : "Amount (Rs.)"}</span>
                    <input type="number" min="1" className={inputClass} value={tier.discountValue} onChange={(e) => updateTier(index, "discountValue", e.target.value)} required />
                  </label>
                  {tier.discountType === "PERCENTAGE" ? (
                    <label className="block text-xs">
                      <span className="mb-1 block text-slate-600">Max discount (Rs.)</span>
                      <input type="number" min="0" className={inputClass} value={tier.maximumDiscountAmount} onChange={(e) => updateTier(index, "maximumDiscountAmount", e.target.value)} placeholder="No limit" />
                    </label>
                  ) : (
                    <div />
                  )}
                  <button
                    type="button"
                    onClick={() => updateField("tiers", form.tiers.filter((_, tierIndex) => tierIndex !== index))}
                    disabled={form.tiers.length === 1}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">Counts only these categories</span>
            <p className="mb-2 text-xs text-slate-500">Leave all unchecked to count every product in the cart.</p>
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {categories.map((category) => (
                <label key={category._id} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={form.allowedCategories.includes(String(category._id))}
                    onChange={() => toggleCategory(String(category._id))}
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.stackWithCoupons} onChange={(e) => updateField("stackWithCoupons", e.target.checked)} />
              Can be used together with coupon codes
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.includeSaleItems} onChange={(e) => updateField("includeSaleItems", e.target.checked)} />
              Products already on sale count towards the cart value
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.includeComboPacks} onChange={(e) => updateField("includeComboPacks", e.target.checked)} />
              Combo packs count towards the cart value
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Saving..." : editingId ? "Save changes" : "Create offer"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading offers...</p>
        ) : rules.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No cart value offers yet. Create one to start nudging customers.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Offer</th>
                  <th className="px-4 py-3">Tiers</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => (
                  <tr key={rule._id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{rule.name}</p>
                      <p className="text-xs text-slate-500">
                        {rule.stackWithCoupons ? "Works with coupons" : "No coupons"}
                        {rule.allowedCategories?.length ? ` · ${rule.allowedCategories.length} categories` : " · All categories"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {[...(rule.tiers || [])]
                          .sort((a, b) => a.minCartAmount - b.minCartAmount)
                          .map((tier) => (
                            <span key={tier.minCartAmount} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                              Rs.{tier.minCartAmount} → {describeTier(tier)}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatDate(rule.startDate)} – {formatDate(rule.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          rule.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {rule.status === "ACTIVE" ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button type="button" onClick={() => openEdit(rule)} className="mr-3 text-xs font-medium text-blue-600 hover:underline">
                        Edit
                      </button>
                      <button type="button" onClick={() => toggleStatus(rule)} className="mr-3 text-xs font-medium text-slate-700 hover:underline">
                        {rule.status === "ACTIVE" ? "Pause" : "Activate"}
                      </button>
                      <button type="button" onClick={() => deleteRule(rule)} className="text-xs font-medium text-rose-600 hover:underline">
                        Delete
                      </button>
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
};

export default CartOfferRulesManager;
