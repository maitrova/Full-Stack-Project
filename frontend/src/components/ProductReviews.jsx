import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareText, SlidersHorizontal, Star } from "lucide-react";
import { selectCurrentToken } from "../redux/slices/Userslice.js";
import { useSelector } from "react-redux";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const KIND_TO_PATH = {
  READYMADE: "readymade",
  DROPPRODUCT: "dropproduct",
};

const emptyBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

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

const renderStars = (rating, className = "h-4 w-4") =>
  [...Array(5)].map((_, index) => {
    const filled = index < Math.round(Number(rating || 0));
    return (
      <Star
        key={`${className}-${index}`}
        className={`${className} ${filled ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
      />
    );
  });

export default function ProductReviews({
  kind,
  targetId,
  initialRating = 0,
  initialReviewCount = 0,
  initialBreakdown = emptyBreakdown,
}) {
  const token = useSelector(selectCurrentToken);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({
    rating: Number(initialRating || 0),
    reviewCount: Number(initialReviewCount || 0),
    ratingBreakdown: initialBreakdown || emptyBreakdown,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [sortOption, setSortOption] = useState("recent");
  const [withComment, setWithComment] = useState(false);

  const reviewPath = KIND_TO_PATH[String(kind || "").toUpperCase()] || null;

  useEffect(() => {
    if (!reviewPath || !targetId) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadReviews = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          sort: sortOption,
          withComment: String(withComment),
          limit: "12",
        });

        if (ratingFilter > 0) {
          params.set("rating", String(ratingFilter));
        }

        const response = await fetch(
          `${API_URL}/reviews/${reviewPath}/${targetId}?${params.toString()}`,
          {
            signal: controller.signal,
          }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Failed to load reviews");
        }

        if (!cancelled) {
          setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
          setSummary({
            rating: Number(data?.summary?.rating || 0),
            reviewCount: Number(data?.summary?.reviewCount || 0),
            ratingBreakdown: data?.summary?.ratingBreakdown || emptyBreakdown,
          });
        }
      } catch (fetchError) {
        if (fetchError.name !== "AbortError" && !cancelled) {
          setError(fetchError.message || "Failed to load reviews");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadReviews();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ratingFilter, reviewPath, sortOption, targetId, withComment]);

  const breakdownEntries = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((star) => {
        const count = Number(summary?.ratingBreakdown?.[star] || 0);
        const total = Number(summary?.reviewCount || 0);
        return {
          star,
          count,
          percent: total > 0 ? Math.round((count / total) * 100) : 0,
        };
      }),
    [summary]
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_#ffffff,_#f8fafc)] px-6 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Customer Reviews
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Verified buyer feedback
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Reviews are accepted after delivery, so the rating reflects actual purchase history.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">{renderStars(summary.rating, "h-5 w-5")}</div>
              <div className="mt-1 text-3xl font-semibold text-slate-900">
                {Number(summary.rating || 0).toFixed(1)}
              </div>
              <div className="text-sm text-slate-500">
                {summary.reviewCount} review{summary.reviewCount === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[0.34fr_0.66fr]">
          <div className="space-y-4">
            {breakdownEntries.map((entry) => (
              <div key={entry.star} className="flex items-center gap-3">
                <div className="flex w-12 items-center gap-1 text-sm font-medium text-slate-700">
                  <span>{entry.star}</span>
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,_#f59e0b,_#fbbf24)]"
                    style={{ width: `${entry.percent}%` }}
                  />
                </div>
                <div className="w-10 text-right text-xs font-medium text-slate-500">
                  {entry.count}
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {token ? (
                <span>
                  Bought this item already? Leave or edit your review from{" "}
                  <Link to="/orders" className="font-semibold text-slate-900 underline">
                    My Orders
                  </Link>
                  .
                </span>
              ) : (
                <span>
                  Sign in and review from your delivered orders once the purchase is completed.
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <SlidersHorizontal className="h-4 w-4" />
                Filter Reviews
              </div>
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
              >
                <option value="recent">Most recent</option>
                <option value="highest">Highest rating</option>
                <option value="lowest">Lowest rating</option>
                <option value="oldest">Oldest first</option>
              </select>
              <select
                value={ratingFilter}
                onChange={(event) => setRatingFilter(Number(event.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
              >
                <option value={0}>All ratings</option>
                <option value={5}>5 stars</option>
                <option value={4}>4 stars</option>
                <option value={3}>3 stars</option>
                <option value={2}>2 stars</option>
                <option value={1}>1 star</option>
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={withComment}
                  onChange={(event) => setWithComment(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Text reviews only
              </label>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                    <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
                    <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : reviews.length ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <article
                    key={review._id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">{renderStars(review.rating)}</div>
                        <h3 className="mt-2 text-base font-semibold text-slate-900">
                          {review.title || "Verified purchase review"}
                        </h3>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {review.userName} • {new Date(review.reviewDate || review.createdAt).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                      {review.verifiedPurchase ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <MessageSquareText className="h-3.5 w-3.5" />
                          Verified Purchase
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {review.comment || "No written comment provided."}
                    </p>
                    {review.photos?.length ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {review.photos.map((photo, photoIndex) => (
                          <a
                            key={`${photo}-${photoIndex}`}
                            href={resolveReviewPhotoUrl(photo)}
                            target="_blank"
                            rel="noreferrer"
                            className="block h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
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
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No reviews match the current filters yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
