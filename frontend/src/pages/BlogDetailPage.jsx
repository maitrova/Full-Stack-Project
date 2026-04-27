import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend/api";

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const BlogDetailPage = () => {
  const { slug } = useParams();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadBlog = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/blogs/slug/${slug}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Failed to load blog");
        }

        if (!cancelled) {
          setBlog(data.blog || null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Failed to load blog");
          setBlog(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadBlog();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const paragraphs = useMemo(
    () =>
      String(blog?.content || "")
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean),
    [blog?.content]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl animate-pulse">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="mt-6 h-12 w-5/6 rounded bg-slate-200" />
          <div className="mt-4 h-4 w-2/3 rounded bg-slate-200" />
          <div className="mt-8 aspect-[16/8] rounded-[28px] bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-rose-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Blog not found</h1>
          <p className="mt-3 text-sm text-slate-600">{error || "The requested article is unavailable."}</p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Back to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition hover:text-sky-800">
          <span>←</span>
          <span>Back to Homepage</span>
        </Link>

        <header className="mt-6 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_34px_90px_-48px_rgba(15,23,42,0.42)]">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-8 sm:p-10 lg:p-12">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">{blog.category}</span>
                {blog.isFeatured ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">Featured</span>
                ) : null}
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                {blog.title}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">
                {blog.excerpt}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{blog.authorName}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{formatDate(blog.publishedAt)}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{blog.readTimeMinutes} min read</span>
              </div>
            </div>

            <div className="min-h-[260px] bg-slate-100">
              {blog.coverImage ? (
                <img src={blog.coverImage} alt={blog.title} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_34%),linear-gradient(135deg,_#0f172a,_#1e293b_48%,_#0f766e)]" />
              )}
            </div>
          </div>
        </header>

        <div className="mx-auto mt-10 max-w-3xl rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <div className="prose prose-slate max-w-none">
            {paragraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 20)}`} className="mb-6 text-[15px] leading-8 text-slate-700 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
};

export default BlogDetailPage;
