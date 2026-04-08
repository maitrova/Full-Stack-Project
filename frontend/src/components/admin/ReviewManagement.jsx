import React, { useEffect, useState } from "react";
import { Search, Star, Trash2 } from "lucide-react";
import { useSelector } from "react-redux";
import { selectCurrentToken } from "../../redux/slices/Userslice.js";

const API_URL = import.meta.env.VITE_API_URL;

const renderStars = (rating) =>
  [...Array(5)].map((_, index) => (
    <Star
      key={index}
      className={`h-4 w-4 ${
        index < Number(rating || 0)
          ? "fill-amber-400 text-amber-400"
          : "text-slate-300"
      }`}
    />
  ));

export default function ReviewManagement() {
  const token = useSelector(selectCurrentToken);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [filters, setFilters] = useState({
    q: "",
    kind: "",
    rating: "",
    page: 1,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });

  const loadReviews = async (nextFilters = filters) => {
    if (!token) return;

    setLoading(true);
    setFeedback((prev) => ({ ...prev, message: prev.type === "error" ? "" : prev.message }));

    try {
      const params = new URLSearchParams({
        page: String(nextFilters.page || 1),
        limit: "20",
      });

      if (nextFilters.q) params.set("q", nextFilters.q);
      if (nextFilters.kind) params.set("kind", nextFilters.kind);
      if (nextFilters.rating) params.set("rating", nextFilters.rating);

      const res = await fetch(`${API_URL}/reviews/admin?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to load reviews");
      }

      setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
      setPagination(
        data?.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          pages: 1,
        }
      );
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to load reviews" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [token]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === "page" ? value : 1,
    }));
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    await loadReviews({ ...filters, page: 1 });
  };

  const handleDelete = async (reviewId) => {
    if (!token || !window.confirm("Delete this review?")) return;

    try {
      const res = await fetch(`${API_URL}/reviews/admin/${reviewId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Failed to delete review");
      }

      setFeedback({ type: "success", message: "Review deleted successfully" });

      const nextPage =
        reviews.length === 1 && Number(filters.page) > 1 ? Number(filters.page) - 1 : Number(filters.page);
      const nextFilters = { ...filters, page: nextPage };
      setFilters(nextFilters);
      await loadReviews(nextFilters);
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to delete review" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSearch} className="grid gap-4 lg:grid-cols-[1.4fr_0.7fr_0.7fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Search reviews</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filters.q}
                onChange={(event) => updateFilter("q", event.target.value)}
                placeholder="Search by customer, product, order, title, or comment"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Product type</span>
            <select
              value={filters.kind}
              onChange={(event) => updateFilter("kind", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            >
              <option value="">All products</option>
              <option value="READYMADE">Readymade</option>
              <option value="DROPPRODUCT">Drop product</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Rating</span>
            <select
              value={filters.rating}
              onChange={(event) => updateFilter("rating", event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            >
              <option value="">All ratings</option>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 lg:w-auto"
            >
              Apply
            </button>
          </div>
        </form>

        {feedback.message ? (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              feedback.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Customer Reviews</h2>
            <p className="mt-1 text-sm text-slate-500">
              {pagination.total} review{pagination.total === 1 ? "" : "s"} found
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 p-4">
                <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
                <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : reviews.length ? (
          <div className="divide-y divide-slate-200">
            {reviews.map((review) => (
              <div key={review._id} className="space-y-4 px-6 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                        {review.kind === "READYMADE" ? "Readymade" : "Drop Product"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        Order #{review.orderId.slice(-8).toUpperCase()}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {new Date(review.createdAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{review.productName}</h3>
                      <p className="text-sm text-slate-500">
                        {review.customerName}
                        {review.customerEmail ? ` • ${review.customerEmail}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
                      <span className="text-sm font-semibold text-slate-700">{review.rating}/5</span>
                    </div>

                    {review.title ? (
                      <p className="text-sm font-semibold text-slate-800">{review.title}</p>
                    ) : null}
                    <p className="max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {review.comment || "No written comment provided."}
                    </p>
                  </div>

                  <div className="flex flex-col items-stretch gap-2 xl:min-w-[170px]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <div className="font-semibold text-slate-800">Order Status</div>
                      <div className="mt-1">{review.orderStatus || "N/A"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(review._id)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No reviews match the current filters.
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.pages}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => {
                const nextFilters = { ...filters, page: pagination.page - 1 };
                setFilters(nextFilters);
                loadReviews(nextFilters);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.pages || loading}
              onClick={() => {
                const nextFilters = { ...filters, page: pagination.page + 1 };
                setFilters(nextFilters);
                loadReviews(nextFilters);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
