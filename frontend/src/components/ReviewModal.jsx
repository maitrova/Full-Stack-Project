import React, { useEffect, useState } from "react";
import { Image, Loader2, Star, X } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const resolveReviewPhotoUrl = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const apiBase = (API_URL || window.location.origin).replace(/\/$/, "");
  const normalizedPath = String(path).replace(/\\/g, "/");

  if (normalizedPath.startsWith("/api/outputs/")) {
    return `${apiBase.replace(/\/api$/i, "")}${normalizedPath}`;
  }

  if (normalizedPath.startsWith("/outputs/")) {
    return `${apiBase}/outputs/${normalizedPath.replace(/^\/outputs\//, "")}`;
  }

  if (normalizedPath.startsWith("outputs/")) {
    return `${apiBase}/${normalizedPath}`;
  }

  return `${apiBase}/${normalizedPath.replace(/^\/+/, "")}`;
};

const renderStarButton = (value, active, onClick) => (
  <button
    key={value}
    type="button"
    onClick={() => onClick(value)}
    className="rounded-full p-1 transition-transform hover:scale-110"
  >
    <Star
      className={`h-7 w-7 ${value <= active ? "fill-amber-400 text-amber-400" : "text-mt-line-strong"}`}
    />
  </button>
);

export default function ReviewModal({ isOpen, onClose, item, orderId, token, productName, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [users, setUsers] = useState("1");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const existing = item?.reviewMeta?.existingReview;
    setRating(Number(existing?.rating || 0));
    setUsers(String(existing?.users || 1));
    setTitle(existing?.title || "");
    setComment(existing?.comment || "");
    setExistingPhotos(Array.isArray(existing?.photos) ? existing.photos : []);
    setPhotos([]);
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

      const payload = new FormData();
      payload.append("orderId", orderId);
      payload.append("kind", item.reviewMeta.kind);
      payload.append("targetId", item.reviewMeta.targetId);
      payload.append("rating", String(rating));
      payload.append("users", String(users || 1));
      payload.append("title", title);
      payload.append("comment", comment);
      photos.forEach((file) => {
        payload.append("photos", file);
      });

      const response = await fetch(`${API_URL}/reviews`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: payload,
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6 font-brand text-mt-text [color-scheme:var(--mt-scheme)] backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[28px] border border-mt-line bg-mt-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-mt-line px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-mt-subtle">
              Verified Review
            </div>
            <h3 className="mt-2 text-2xl font-semibold text-mt-text">
              {item?.reviewMeta?.existingReview ? "Edit your review" : "Write a review"}
            </h3>
            <p className="mt-2 text-sm text-mt-muted">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-mt-line p-2 text-mt-subtle transition hover:bg-mt-tint/5 hover:text-mt-text"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-132px)] space-y-5 overflow-y-auto px-6 py-6">
          <div>
            <label className="block text-sm font-medium text-mt-muted">Your rating</label>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => renderStarButton(value, rating, setRating))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-mt-muted">Users</label>
            <input
              type="number"
              min="1"
              value={users}
              onChange={(event) => setUsers(event.target.value)}
              placeholder="1"
              className="mt-2 w-full rounded-2xl border border-mt-line px-4 py-3 text-sm text-mt-text outline-none transition focus:border-mt-text"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mt-muted">Review title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="Summarize your experience"
              className="mt-2 w-full rounded-2xl border border-mt-line px-4 py-3 text-sm text-mt-text outline-none transition focus:border-mt-text"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mt-muted">Detailed review</label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={6}
              maxLength={1500}
              placeholder="Share what you liked, sizing experience, material quality, delivery condition, and anything that helps other shoppers."
              className="mt-2 w-full resize-none rounded-2xl border border-mt-line px-4 py-3 text-sm leading-6 text-mt-text outline-none transition focus:border-mt-text"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mt-muted">Review photos</label>
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-mt-line-strong bg-mt-bg px-4 py-4 text-sm font-semibold text-mt-muted transition hover:bg-mt-tint/10">
              <Image className="h-4 w-4" />
              Upload photos
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                multiple
                onChange={(event) => setPhotos(Array.from(event.target.files || []))}
                className="hidden"
              />
            </label>
            {photos.length ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-mt-subtle">
                {photos.map((file, index) => (
                  <span key={`${file.name}-${index}`} className="rounded-full bg-mt-surface-raised px-3 py-1">
                    {file.name}
                  </span>
                ))}
              </div>
            ) : null}
            {existingPhotos.length ? (
              <div className="mt-3 flex flex-wrap gap-3">
                {existingPhotos.map((photo, index) => (
                  <a
                    key={`${photo}-${index}`}
                    href={resolveReviewPhotoUrl(photo)}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-20 w-20 overflow-hidden rounded-xl border border-mt-line bg-mt-surface-raised"
                  >
                    <img
                      src={resolveReviewPhotoUrl(photo)}
                      alt={`Review photo ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-2xl border border-mt-danger/30 bg-mt-danger/10 px-4 py-3 text-sm text-mt-danger">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-mt-line pt-5 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-mt-line bg-mt-surface px-5 py-3 text-sm font-semibold text-mt-text transition hover:bg-mt-tint/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-mt-btn px-5 py-3 text-sm font-semibold text-mt-btn-text transition hover:bg-mt-btn-hover disabled:opacity-60"
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
