import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { buildImageUrl } from "../utils/responsiveImage.js";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend/api";

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const BlogCard = ({ blog, index }) => (
  <article className="group relative w-[260px] min-w-[260px] snap-start overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_44px_-34px_rgba(15,23,42,0.38)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_56px_-30px_rgba(15,23,42,0.42)] sm:w-[280px] sm:min-w-[280px]">
    <Link to={`/blogs/${blog.slug}`} className="grid h-full">
      <div className="relative aspect-[16/9] overflow-hidden">
        {blog.coverImage ? (
          <img
            src={buildImageUrl(blog.coverImage)}
            alt={blog.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.24),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.26),_transparent_28%),linear-gradient(135deg,_#0f172a,_#172554_45%,_#0f766e)]" />
        )}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.16)_50%,rgba(15,23,42,0.72))]" />

        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
            {blog.category}
          </span>
          {blog.isFeatured ? (
            <span className="rounded-full border border-amber-200/70 bg-amber-50/95 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Featured
            </span>
          ) : null}
        </div>

        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-3 px-4 pb-4">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Issue {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-1.5 line-clamp-2 text-lg font-semibold leading-tight tracking-[-0.02em] text-white">
              {blog.title}
            </h3>
          </div>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-base text-white backdrop-blur-md transition group-hover:translate-x-1">
            {">"}
          </span>
        </div>
      </div>

      <div className="relative flex h-full flex-col justify-between px-4 pb-4 pt-3.5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
          <span className="text-slate-700 line-clamp-1">{blog.authorName}</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>{formatDate(blog.publishedAt)}</span>
        </div>

        <p className="mt-2.5 line-clamp-2 text-sm leading-6 text-slate-600">
          {blog.excerpt}
        </p>

        <div className="mt-3 flex items-center justify-between border-t border-slate-200/80 pt-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-800">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {blog.readTimeMinutes} min read
          </div>
          <span className="text-xs font-semibold text-sky-700 transition group-hover:text-sky-800">
            Read
          </span>
        </div>
      </div>
    </Link>
  </article>
);

const HomeBlogsSection = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const railRef = useRef(null);
  const directionRef = useRef(1);
  const resumeTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const loadBlogs = async () => {
      try {
        const response = await fetch(`${API_URL}/blogs?limit=8`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Failed to load blogs");
        }

        if (!cancelled) {
          setBlogs(Array.isArray(data?.blogs) ? data.blogs : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load homepage blogs:", error);
          setBlogs([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadBlogs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || blogs.length < 2) return undefined;

    const rail = railRef.current;
    if (!rail) return undefined;

    const timer = window.setInterval(() => {
      if (isPaused) return;

      const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
      if (maxScrollLeft <= 0) return;

      if (rail.scrollLeft <= 0) {
        directionRef.current = 1;
      } else if (rail.scrollLeft >= maxScrollLeft) {
        directionRef.current = -1;
      }

      rail.scrollLeft += directionRef.current * 1.1;
    }, 16);

    return () => window.clearInterval(timer);
  }, [blogs, isPaused, loading]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;

    const updateScrollState = () => {
      const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
      setCanScrollLeft(rail.scrollLeft > 4);
      setCanScrollRight(rail.scrollLeft < maxScrollLeft - 4);
    };

    updateScrollState();
    rail.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      rail.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [blogs, loading]);

  if (!loading && blogs.length === 0) return null;

  const getScrollStep = () => {
    const rail = railRef.current;
    const firstCard = rail?.firstElementChild;
    if (!rail || !firstCard) return 320;

    const cardWidth = firstCard.getBoundingClientRect().width;
    const styles = window.getComputedStyle(rail);
    const gap = parseFloat(styles.columnGap || styles.gap || "16") || 16;
    return cardWidth + gap;
  };

  const pauseAutoScrollTemporarily = () => {
    setIsPaused(true);
    window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      setIsPaused(false);
    }, 1800);
  };

  const scrollRail = (direction) => {
    directionRef.current = direction;
    const rail = railRef.current;
    if (!rail) return;
    pauseAutoScrollTemporarily();
    rail.scrollBy({ left: getScrollStep() * direction, behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_42%,#f8fafc_100%)] px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_34%)]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">Blog</p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900 sm:text-xl">Latest Reads</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollRail(-1)}
              disabled={!canScrollLeft}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Scroll blogs left"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scrollRail(1)}
              disabled={!canScrollRight}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Scroll blogs right"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="w-[260px] min-w-[260px] overflow-hidden rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.38)] sm:w-[280px] sm:min-w-[280px]"
              >
                <div className="aspect-[16/9] animate-pulse rounded-[18px] bg-slate-200" />
                <div className="mt-4 h-3 w-24 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-7 w-4/5 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-12 animate-pulse rounded bg-slate-100" />
                <div className="mt-3 h-8 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#f8fafc] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#f8fafc] to-transparent" />
            <div
              ref={railRef}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {blogs.map((blog, index) => (
                <BlogCard key={blog._id} blog={blog} index={index} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default HomeBlogsSection;
