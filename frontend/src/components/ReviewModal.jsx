import React, { useEffect, useState } from "react";
import { Loader2, Star, X } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const renderStarButton = (value, active, onClick) => (
  <button
    key={value}
    type="button"
    onClick={() => onClick(value)}
    className="rounded-full p-1 transition-transform hover:scale-110"
  >
    <Star
      className={`h-7 w-7 ${value <= active ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
    />
  </button>
);

export default function ReviewModal({ isOpen, onClose, item, orderId, token, productName, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const existing = item?.reviewMeta?.existingReview;
    setRating(Number(existing?.rating || 0));
    setTitle(existing?.title || "");
    setComment(existing?.comment || "");
    setError("");
  }, [isOpen, item]);

  if (!isOpen || !item?.reviewMeta?.kind || !item?.reviewMeta?.targetId) {
    return null;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!token) {
      setError("Please log in to submit a review.");
      return;
    }

    if (!rating) {
      setError("Please select a rating.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(`${API_URL}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          kind: item.reviewMeta.kind,
          targetId: item.reviewMeta.targetId,
          rating,
          title,
          comment,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to save review");
      }

      onSubmitted?.(data);
      onClose?.();
    } catch (submitError) {
      setError(submitError.message || "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Verified Review
            </div>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">
              {item?.reviewMeta?.existingReview ? "Edit your review" : "Write a review"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div>
            <label className="block text-sm font-medium text-slate-700">Your rating</label>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => renderStarButton(value, rating, setRating))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Review title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="Summarize your experience"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Detailed review</label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={6}
              maxLength={1500}
              placeholder="Share what you liked, sizing experience, material quality, delivery condition, and anything that helps other shoppers."
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-slate-400"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {item?.reviewMeta?.existingReview ? "Update Review" : "Submit Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
