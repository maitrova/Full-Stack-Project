import React, { useEffect, useState } from "react";
import { Plus, Save, Tag, Trash2 } from "lucide-react";
import { useSelector } from "react-redux";
import { selectCurrentToken } from "../../redux/slices/Userslice.js";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend/api";

const createEmptyMessage = () => "";

const normalizeBanner = (banner) => ({
  messages:
    Array.isArray(banner?.messages) && banner.messages.length > 0
      ? banner.messages.map((message) => String(message || ""))
      : [createEmptyMessage()],
  couponCode: String(banner?.couponCode || ""),
  codMinimumOrderAmount: Number(banner?.codMinimumOrderAmount || 0),
});

export default function HeaderBannerSettings() {
  const token = useSelector(selectCurrentToken);
  const [form, setForm] = useState(() => normalizeBanner());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const loadBanner = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/header-banner/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to load header banner settings");
      }
      setForm(normalizeBanner(data));
      setFeedback({ type: "", message: "" });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to load settings" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanner();
  }, [token]);

  const updateMessage = (index, value) => {
    setForm((current) => ({
      ...current,
      messages: current.messages.map((message, messageIndex) =>
        messageIndex === index ? value : message
      ),
    }));
  };

  const addMessage = () => {
    setForm((current) => ({
      ...current,
      messages: [...current.messages, createEmptyMessage()],
    }));
  };

  const removeMessage = (index) => {
    setForm((current) => {
      const nextMessages = current.messages.filter((_, messageIndex) => messageIndex !== index);
      return {
        ...current,
        messages: nextMessages.length > 0 ? nextMessages : [createEmptyMessage()],
      };
    });
  };

  const handleSave = async () => {
    if (!token) return;

    setSaving(true);
    setFeedback({ type: "", message: "" });
    try {
      const payload = {
        messages: form.messages.map((message) => String(message || "").trim()).filter(Boolean),
        couponCode: String(form.couponCode || "").trim(),
        codMinimumOrderAmount: Number(form.codMinimumOrderAmount || 0),
      };

      const res = await fetch(`${API_URL}/header-banner/admin`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to save header banner settings");
      }

      setForm(normalizeBanner(data.banner));
      setFeedback({ type: "success", message: data.message || "Header banner updated" });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
            Store Settings
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Header banner and COD settings
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Control the top header banner, promo coupon display, and the minimum order amount
            required for cash on delivery from one admin page.
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            Admin path: Dashboard &gt; Settings
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saving || !token}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {feedback.message ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          Loading banner settings...
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Banner texts</p>
                <p className="mt-1 text-xs text-slate-500">
                  Each non-empty row becomes one banner item.
                </p>
              </div>
              <button
                type="button"
                onClick={addMessage}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <Plus className="h-4 w-4" />
                Add Text
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {form.messages.map((message, index) => (
                <div
                  key={`banner-message-${index}`}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sm font-semibold text-sky-700">
                    {index + 1}
                  </div>
                  <textarea
                    value={message}
                    onChange={(event) => updateMessage(index, event.target.value)}
                    rows={2}
                    placeholder="Example: Free shipping on every prepaid order"
                    className="min-h-[76px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeMessage(index)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                    aria-label={`Remove banner text ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Coupon field</p>
                  <p className="text-xs text-slate-500">
                    One coupon code displayed separately in the banner.
                  </p>
                </div>
              </div>

              <input
                type="text"
                value={form.couponCode}
                onChange={(event) =>
                  setForm((current) => ({ ...current, couponCode: event.target.value }))
                }
                placeholder="Example: SUMMER40"
                className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium uppercase tracking-[0.12em] text-slate-700 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div>
                <p className="text-sm font-semibold text-slate-900">Cash on delivery settings</p>
                <p className="mt-1 text-xs text-slate-500">
                  Set the minimum order amount allowed for COD. Use 0 to allow COD with no
                  minimum amount.
                </p>
              </div>

              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                COD minimum order amount
              </label>
              <input
                type="number"
                min="0"
                value={form.codMinimumOrderAmount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    codMinimumOrderAmount: event.target.value,
                  }))
                }
                placeholder="0"
                className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,_#eff6ff,_#ffffff,_#fff7ed)] p-5">
              <p className="text-sm font-semibold text-slate-900">Preview</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {form.messages
                  .map((message) => String(message || "").trim())
                  .filter(Boolean)
                  .map((message, index) => (
                    <span
                      key={`preview-message-${index}`}
                      className="rounded-full border border-sky-100 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                    >
                      {message}
                    </span>
                  ))}
                {String(form.couponCode || "").trim() ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 shadow-sm">
                    Coupon: {String(form.couponCode || "").trim()}
                  </span>
                ) : null}
                {Number(form.codMinimumOrderAmount || 0) > 0 ? (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                    COD min: Rs. {Number(form.codMinimumOrderAmount).toFixed(2)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
