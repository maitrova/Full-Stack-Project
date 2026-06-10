import React, { useEffect, useMemo, useState } from "react";
import { Image, Plus, Search, Star, Trash2, X } from "lucide-react";
import { useSelector } from "react-redux";
import { selectCurrentToken } from "../../redux/slices/Userslice.js";

const API_URL = import.meta.env.VITE_API_URL;

const createReviewEntry = () => ({
  reviewerName: "",
  reviewerEmail: "",
  rating: "5",
  users: "1",
  reviewDate: new Date().toISOString().slice(0, 10),
  title: "",
  comment: "",
  verifiedPurchase: false,
  photos: [],
});

const createReviewForm = () => ({
  reviews: [createReviewEntry()],
  targets: [],
});

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

const normalizeProductOption = (product, kind) => ({
  id: String(product._id),
  kind,
  label:
    kind === "READYMADE"
      ? product.title || product.name || "Untitled readymade product"
      : product.name || "Untitled drop product",
  meta:
    kind === "READYMADE"
      ? [product.category?.name || product.category, product.subCategory?.name || product.subCategory]
          .filter(Boolean)
          .join(" / ")
      : [product.category, product.subCategory].filter(Boolean).join(" / "),
});

export default function ReviewManagement() {
  const token = useSelector(selectCurrentToken);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productOptionsLoading, setProductOptionsLoading] = useState(false);
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
  const [productOptions, setProductOptions] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [reviewForm, setReviewForm] = useState(createReviewForm);

  const selectedTargetKeys = useMemo(
    () => new Set(reviewForm.targets.map((target) => `${target.kind}:${target.targetId}`)),
    [reviewForm.targets]
  );

  const filteredProductOptions = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return productOptions;

    return productOptions.filter((product) =>
      [product.label, product.meta, product.kind].join(" ").toLowerCase().includes(query)
    );
  }, [productOptions, productSearch]);

  const groupedProductOptions = useMemo(
    () => ({
      READYMADE: filteredProductOptions.filter((product) => product.kind === "READYMADE"),
      DROPPRODUCT: filteredProductOptions.filter((product) => product.kind === "DROPPRODUCT"),
    }),
    [filteredProductOptions]
  );

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

  const loadProductOptions = async () => {
    if (!token) return;

    setProductOptionsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [readymadeRes, dropRes] = await Promise.all([
        fetch(`${API_URL}/readymadeproducts/admin/all?limit=500`, { headers }),
        fetch(`${API_URL}/dropproducts`, { headers }),
      ]);

      const [readymadeData, dropData] = await Promise.all([
        readymadeRes.json(),
        dropRes.json(),
      ]);

      if (!readymadeRes.ok) {
        throw new Error(readymadeData?.message || "Failed to load readymade products");
      }

      if (!dropRes.ok) {
        throw new Error(dropData?.message || "Failed to load drop products");
      }

      const readymadeProducts = Array.isArray(readymadeData?.data)
        ? readymadeData.data.map((product) => normalizeProductOption(product, "READYMADE"))
        : [];
      const dropProducts = Array.isArray(dropData)
        ? dropData.map((product) => normalizeProductOption(product, "DROPPRODUCT"))
        : [];

      setProductOptions(
        [...readymadeProducts, ...dropProducts].sort((a, b) =>
          `${a.kind} ${a.label}`.localeCompare(`${b.kind} ${b.label}`)
        )
      );
    } catch (error) {
      setFeedback((prev) =>
        prev.message ? prev : { type: "error", message: error.message || "Failed to load products" }
      );
    } finally {
      setProductOptionsLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [token]);

  useEffect(() => {
    loadProductOptions();
  }, [token]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === "page" ? value : 1,
    }));
  };

  const updateReviewForm = (key, value) => {
    setReviewForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateReviewEntry = (index, key, value) => {
    setReviewForm((prev) => ({
      ...prev,
      reviews: prev.reviews.map((review, reviewIndex) =>
        reviewIndex === index ? { ...review, [key]: value } : review
      ),
    }));
  };

  const addReviewEntry = () => {
    setReviewForm((prev) => ({
      ...prev,
      reviews: [...prev.reviews, createReviewEntry()],
    }));
  };

  const removeReviewEntry = (index) => {
    setReviewForm((prev) => ({
      ...prev,
      reviews:
        prev.reviews.length > 1
          ? prev.reviews.filter((_, reviewIndex) => reviewIndex !== index)
          : prev.reviews,
    }));
  };

  const updateReviewPhotos = (index, files) => {
    updateReviewEntry(index, "photos", Array.from(files || []));
  };

  const toggleTarget = (product) => {
    const targetKey = `${product.kind}:${product.id}`;

    setReviewForm((prev) => {
      const exists = prev.targets.some(
        (target) => `${target.kind}:${target.targetId}` === targetKey
      );

      return {
        ...prev,
        targets: exists
          ? prev.targets.filter((target) => `${target.kind}:${target.targetId}` !== targetKey)
          : [...prev.targets, { kind: product.kind, targetId: product.id }],
      };
    });
  };

  const toggleVisibleGroup = (kind) => {
    const visibleProducts = groupedProductOptions[kind];
    const visibleKeys = visibleProducts.map((product) => `${product.kind}:${product.id}`);
    const allSelected = visibleKeys.every((key) => selectedTargetKeys.has(key));

    setReviewForm((prev) => {
      const remainingTargets = prev.targets.filter(
        (target) => !visibleKeys.includes(`${target.kind}:${target.targetId}`)
      );

      if (allSelected) {
        return { ...prev, targets: remainingTargets };
      }

      return {
        ...prev,
        targets: [
          ...remainingTargets,
          ...visibleProducts.map((product) => ({
            kind: product.kind,
            targetId: product.id,
          })),
        ],
      };
    });
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    await loadReviews({ ...filters, page: 1 });
  };

  const handleCreateReviews = async (event) => {
    event.preventDefault();
    if (!token || saving) return;

    setSaving(true);
    try {
      const payloadReviews = reviewForm.reviews.map((review) => ({
        reviewerName: review.reviewerName,
        reviewerEmail: review.reviewerEmail,
        rating: Number(review.rating),
        users: Number(review.users || 1),
        reviewDate: review.reviewDate,
        title: review.title,
        comment: review.comment,
        verifiedPurchase: review.verifiedPurchase,
      }));

      const formData = new FormData();
      formData.append("targets", JSON.stringify(reviewForm.targets));
      formData.append("reviews", JSON.stringify(payloadReviews));
      reviewForm.reviews.forEach((review, reviewIndex) => {
        (review.photos || []).forEach((file) => {
          formData.append(`photos_${reviewIndex}`, file);
        });
      });

      const res = await fetch(`${API_URL}/reviews/admin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to add reviews");
      }

      setFeedback({ type: "success", message: data?.message || "Reviews added successfully" });
      setReviewForm(createReviewForm());
      setProductSearch("");
      await loadReviews({ ...filters, page: 1 });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to add reviews" });
    } finally {
      setSaving(false);
    }
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
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Add Product Reviews</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select one or many readymade or drop products and publish the same review to all of them.
          </p>
        </div>

        <form onSubmit={handleCreateReviews} className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Review entries</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Add different names and calendar dates for the selected product.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addReviewEntry}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Add review
                </button>
              </div>

              {reviewForm.reviews.map((review, reviewIndex) => (
                <div key={reviewIndex} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">
                      Review #{reviewIndex + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeReviewEntry(reviewIndex)}
                      disabled={reviewForm.reviews.length === 1}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Reviewer name</span>
                      <input
                        type="text"
                        value={review.reviewerName}
                        onChange={(event) => updateReviewEntry(reviewIndex, "reviewerName", event.target.value)}
                        placeholder="Customer name"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Reviewer email</span>
                      <input
                        type="email"
                        value={review.reviewerEmail}
                        onChange={(event) => updateReviewEntry(reviewIndex, "reviewerEmail", event.target.value)}
                        placeholder="customer@example.com"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Rating</span>
                      <select
                        value={review.rating}
                        onChange={(event) => updateReviewEntry(reviewIndex, "rating", event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                      >
                        <option value="5">5 stars</option>
                        <option value="4">4 stars</option>
                        <option value="3">3 stars</option>
                        <option value="2">2 stars</option>
                        <option value="1">1 star</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Review date</span>
                      <input
                        type="date"
                        value={review.reviewDate}
                        onChange={(event) => updateReviewEntry(reviewIndex, "reviewDate", event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Users</span>
                      <input
                        type="number"
                        min="1"
                        value={review.users}
                        onChange={(event) => updateReviewEntry(reviewIndex, "users", event.target.value)}
                        placeholder="1"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                      />
                    </label>

                    <label className="flex items-end">
                      <span className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={review.verifiedPurchase}
                          onChange={(event) =>
                            updateReviewEntry(reviewIndex, "verifiedPurchase", event.target.checked)
                          }
                          className="h-4 w-4"
                        />
                        Mark as verified purchase
                      </span>
                    </label>
                  </div>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Review title</span>
                    <input
                      type="text"
                      value={review.title}
                      onChange={(event) => updateReviewEntry(reviewIndex, "title", event.target.value)}
                      placeholder="Short headline"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                    />
                  </label>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Review comment</span>
                    <textarea
                      value={review.comment}
                      onChange={(event) => updateReviewEntry(reviewIndex, "comment", event.target.value)}
                      rows={4}
                      placeholder="Write this customer's review."
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                    />
                  </label>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Review photos</span>
                    <span className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                      <Image className="h-4 w-4" />
                      Upload photos
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        multiple
                        onChange={(event) => updateReviewPhotos(reviewIndex, event.target.files)}
                        className="hidden"
                      />
                    </span>
                  </label>

                  {review.photos?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {review.photos.map((file, fileIndex) => (
                        <span key={`${file.name}-${fileIndex}`} className="rounded-full bg-slate-100 px-3 py-1">
                          {file.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Select products</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {reviewForm.targets.length} product{reviewForm.targets.length === 1 ? "" : "s"} selected
                  </div>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search products"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {["READYMADE", "DROPPRODUCT"].map((kind) => {
                  const items = groupedProductOptions[kind];
                  const selectedCount = items.filter((product) =>
                    selectedTargetKeys.has(`${product.kind}:${product.id}`)
                  ).length;

                  return (
                    <div key={kind} className="rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {kind === "READYMADE" ? "Readymade products" : "Drop products"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {selectedCount}/{items.length} visible selected
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleVisibleGroup(kind)}
                          disabled={!items.length}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {items.length && selectedCount === items.length ? "Clear visible" : "Select visible"}
                        </button>
                      </div>

                      <div className="max-h-80 space-y-2 overflow-y-auto p-3">
                        {productOptionsLoading ? (
                          <div className="text-sm text-slate-500">Loading products...</div>
                        ) : items.length ? (
                          items.map((product) => {
                            const checked = selectedTargetKeys.has(`${product.kind}:${product.id}`);

                            return (
                              <label
                                key={`${product.kind}:${product.id}`}
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                                  checked
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleTarget(product)}
                                  className="mt-1 h-4 w-4"
                                />
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold">{product.label}</span>
                                  <span className={`mt-1 block text-xs ${checked ? "text-slate-200" : "text-slate-500"}`}>
                                    {product.meta || "No category details"}
                                  </span>
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <div className="text-sm text-slate-500">No products match the current search.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              This will create {(reviewForm.targets.length || 0) * reviewForm.reviews.length} review
              {(reviewForm.targets.length || 0) * reviewForm.reviews.length === 1 ? "" : "s"}.
            </div>
            <button
              type="submit"
              disabled={saving || reviewForm.targets.length === 0}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Reviews"}
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
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          review.source === "ADMIN"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {review.source === "ADMIN" ? "Added by admin" : "Customer review"}
                      </span>
                      {review.orderId ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          Order #{review.orderId.slice(-8).toUpperCase()}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {new Date(review.reviewDate || review.createdAt).toLocaleDateString("en-IN")}
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
                      {review.users ? (
                        <span className="text-sm font-medium text-slate-500">Users: {review.users}</span>
                      ) : null}
                    </div>

                    {review.title ? (
                      <p className="text-sm font-semibold text-slate-800">{review.title}</p>
                    ) : null}
                    <p className="max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {review.comment || "No written comment provided."}
                    </p>
                    {review.photos?.length ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {review.photos.map((photo, photoIndex) => (
                          <a
                            key={`${photo}-${photoIndex}`}
                            href={resolveReviewPhotoUrl(photo)}
                            target="_blank"
                            rel="noreferrer"
                            className="block h-20 w-20 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                          >
                            <img
                              src={resolveReviewPhotoUrl(photo)}
                              alt={`Review photo ${photoIndex + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    ) : null}
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
