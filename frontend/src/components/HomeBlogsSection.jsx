import React, { useEffect, useState } from "react";
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

const BlogCard = ({ blog }) => (
  <article className="group relative w-[260px] min-w-[260px] overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_44px_-34px_rgba(15,23,42,0.22)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_46px_-30px_rgba(15,23,42,0.26)] sm:w-[312px] sm:min-w-[312px] sm:snap-start">
    <Link to={`/blogs/${blog.slug}`} className="grid h-full">
      <div className="aspect-[3/2] overflow-hidden bg-slate-100">
        {blog.coverImage ? (
          <img
            src={buildImageUrl(blog.coverImage)}
            alt={blog.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_28%),linear-gradient(135deg,_#e2e8f0,_#f8fafc_45%,_#e2e8f0)]" />
        )}
      </div>

      <div className="relative flex h-full flex-col justify-between px-4 pb-4 pt-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
            {blog.category}
          </div>

          <h3 className="mt-2 line-clamp-2 text-lg font-semibold leading-tight tracking-[-0.01em] text-slate-900">
            {blog.title}
          </h3>
        </div>

        <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-slate-600">
          {blog.excerpt}
        </p>

        <div className="mt-3 flex items-center justify-between border-t border-slate-200/80 pt-3">
          <div className="text-xs font-medium text-slate-500">
            {formatDate(blog.publishedAt)}
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

  if (!loading && blogs.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_42%,#f8fafc_100%)] px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_38%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_34%)]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">Blog</p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-900 sm:text-xl">Latest from the blog</h2>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="w-[260px] min-w-[260px] overflow-hidden rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.22)] sm:w-[312px] sm:min-w-[312px]"
              >
                <div className="aspect-[3/2] animate-pulse rounded-[18px] bg-slate-200" />
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
              className="flex touch-auto gap-4 overflow-x-auto overscroll-x-contain pb-3 sm:snap-x sm:snap-mandatory"
            >
              {blogs.map((blog) => (
                <BlogCard key={blog._id} blog={blog} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default HomeBlogsSection;
