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
  <article className="group relative w-[88vw] max-w-[430px] min-w-[310px] snap-start overflow-hidden rounded-[32px] border border-white/60 bg-white/90 shadow-[0_32px_90px_-50px_rgba(15,23,42,0.42)] backdrop-blur transition duration-500 hover:-translate-y-1.5 hover:shadow-[0_38px_110px_-46px_rgba(15,23,42,0.5)]">
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),transparent_28%,rgba(15,23,42,0.03))]" />
    <Link to={`/blogs/${blog.slug}`} className="grid h-full">
      <div className="relative aspect-[16/10] overflow-hidden">
        {blog.coverImage ? (
          <img
            src={buildImageUrl(blog.coverImage)}
            alt={blog.title}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.24),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.26),_transparent_28%),linear-gradient(135deg,_#0f172a,_#172554_45%,_#0f766e)]" />
        )}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0.18)_52%,rgba(15,23,42,0.78))]" />

        <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white backdrop-blur-md">
            {blog.category}
          </span>
          {blog.isFeatured ? (
            <span className="rounded-full border border-amber-200/70 bg-amber-50/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Featured
            </span>
          ) : null}
        </div>

        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-4 px-5 pb-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">
              Issue {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-2 line-clamp-2 text-[1.55rem] font-semibold leading-tight tracking-[-0.03em] text-white">
              {blog.title}
            </h3>
          </div>
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg text-white backdrop-blur-md transition group-hover:translate-x-1">
            {">"}
          </span>
        </div>
      </div>

      <div className="relative flex h-full flex-col justify-between px-6 pb-6 pt-5 sm:px-7 sm:pb-7">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
          <span className="text-slate-700">{blog.authorName}</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>{formatDate(blog.publishedAt)}</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>{blog.readTimeMinutes} min read</span>
        </div>

        <p className="mt-4 line-clamp-3 text-[15px] leading-7 text-slate-600">
          {blog.excerpt}
        </p>

        <div className="mt-6 flex items-center justify-between border-t border-slate-200/80 pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-800">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Latest Journal
          </div>
          <span className="text-sm font-semibold text-sky-700 transition group-hover:text-sky-800">
            Read article
          </span>
        </div>
      </div>
    </Link>
  </article>
);

const HomeBlogsSection = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const railRef = useRef(null);
  const directionRef = useRef(1);

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
  }, [blogs, loading]);

  if (!loading && blogs.length === 0) return null;

  const scrollRail = (delta, direction) => {
    directionRef.current = direction;
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_38%,#f8fafc_100%)] px-4 py-18 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_34%)]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10 rounded-[34px] border border-white/60 bg-white/65 px-6 py-7 shadow-[0_22px_70px_-52px_rgba(15,23,42,0.5)] backdrop-blur sm:px-8 lg:px-10">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-3 rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                Commerce Journal
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[3.2rem] sm:leading-[1.04]">
                Modern stories for brands building sharper commerce experiences.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Strategy, design thinking, and product-side decisions curated in a cleaner editorial format.
              </p>
            </div>

            <div className="flex items-end justify-between gap-6 lg:flex-col lg:items-end">
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Published</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{blogs.length || 0}</div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Format</div>
                  <div className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Scroll</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => scrollRail(-360, -1)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                  aria-label="Scroll blogs left"
                >
                  {"<"}
                </button>
                <button
                  type="button"
                  onClick={() => scrollRail(360, 1)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                  aria-label="Scroll blogs right"
                >
                  {">"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-6 overflow-hidden">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="w-[88vw] max-w-[430px] min-w-[310px] overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.55)]"
              >
                <div className="aspect-[16/10] animate-pulse rounded-[24px] bg-slate-200" />
                <div className="mt-5 h-3 w-28 animate-pulse rounded bg-slate-200" />
                <div className="mt-4 h-8 w-4/5 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-16 animate-pulse rounded bg-slate-100" />
                <div className="mt-6 h-10 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <div
            ref={railRef}
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {blogs.map((blog, index) => (
              <BlogCard key={blog._id} blog={blog} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HomeBlogsSection;
