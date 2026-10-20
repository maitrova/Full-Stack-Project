import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { buildImageUrl } from "../utils/responsiveImage.js";
import { SectionHeader, Skeleton } from "./ui/index.js";

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
  <article className="group w-[260px] min-w-[260px] font-brand sm:w-[312px] sm:min-w-[312px] sm:snap-start">
    <Link to={`/blogs/${blog.slug}`} className="flex h-full flex-col overflow-hidden rounded-mt-card border border-mt-line bg-mt-surface transition-colors hover:border-mt-line-strong">
      <div className="aspect-[3/2] overflow-hidden bg-mt-surface-raised">
        {blog.coverImage ? (
          <img
            src={buildImageUrl(blog.coverImage)}
            alt={blog.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,var(--mt-surface-raised),var(--mt-surface))]" />
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between px-4 pb-4 pt-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-mt-subtle">{blog.category}</div>
          <h3 className="mt-2 line-clamp-2 text-base font-medium leading-snug text-mt-text sm:text-lg">
            {blog.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-mt-muted">{blog.excerpt}</p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-mt-line pt-3">
          <span className="text-xs text-mt-subtle">{formatDate(blog.publishedAt)}</span>
          <span className="inline-flex items-center gap-1 text-sm text-mt-text">
            Read
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
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
    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-14">
      <SectionHeader title="From the journal" eyebrow="Blog" className="mb-3 sm:mb-5" />

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((item) => (
            <div key={item} className="w-[260px] min-w-[260px] sm:w-[312px] sm:min-w-[312px]">
              <Skeleton className="aspect-[3/2] w-full" />
              <Skeleton className="mt-4 h-3 w-24" />
              <Skeleton className="mt-3 h-6 w-4/5" />
              <Skeleton className="mt-3 h-10 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex touch-auto gap-3 overflow-x-auto overscroll-x-contain pb-2 sm:snap-x sm:snap-mandatory" style={{ scrollbarWidth: "none" }}>
          {blogs.map((blog) => (
            <BlogCard key={blog._id} blog={blog} />
          ))}
        </div>
      )}
    </section>
  );
};

export default HomeBlogsSection;
