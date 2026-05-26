import React, { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Link, useParams } from "react-router-dom";
import { buildImageUrl } from "../utils/responsiveImage.js";

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

const slugifyHeading = (value = "") =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeHeadingLabel = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const normalizeContentHtml = (value) => {
  const next = String(value || "").trim();
  if (!next) return "";
  if (/<[a-z][\s\S]*>/i.test(next)) return next;

  return next
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${part.replace(/\n/g, "<br />")}</p>`)
    .join("");
};

const sanitizeHtml = (value) =>
  DOMPurify.sanitize(value || "", {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["target", "rel", "class", "id", "src", "alt", "title", "data-blog-image", "data-href"],
  });

const setMetaTag = (name, content) => {
  if (!content) return;
  let element = document.head.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
};

const BlogDetailPage = () => {
  const { slug } = useParams();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadPageData = async () => {
      try {
        setLoading(true);
        setError("");

        const blogResponse = await fetch(`${API_URL}/blogs/slug/${slug}`);
        const blogData = await blogResponse.json();

        if (!blogResponse.ok) {
          throw new Error(blogData?.message || "Failed to load blog");
        }

        if (cancelled) return;
        setBlog(blogData.blog || null);
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

    loadPageData();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const contentData = useMemo(() => {
    const rawContent = normalizeContentHtml(blog?.content || "");
    const safeContent = sanitizeHtml(rawContent);
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="blog-root">${safeContent}</div>`, "text/html");
    const root = doc.getElementById("blog-root");
    const headings = [];
    const sectionImagesByHeading = new Map();
    const usedSectionImages = new Set();

    (blog?.sectionImages || []).forEach((item) => {
      const key = normalizeHeadingLabel(item?.targetHeading || "");
      if (!key || sectionImagesByHeading.has(key)) return;
      sectionImagesByHeading.set(key, item);
    });

    root?.querySelectorAll("h1, h2, h3").forEach((heading, index) => {
      const level = heading.tagName.toLowerCase() === "h3" ? 3 : 2;
      if (heading.tagName.toLowerCase() === "h1") {
        const replacement = doc.createElement("h2");
        replacement.innerHTML = heading.innerHTML;
        heading.replaceWith(replacement);
        heading = replacement;
      }

      const text = heading.textContent?.trim() || "";
      const id = `${slugifyHeading(text) || "section"}-${index + 1}`;
      heading.id = id;
      if (level === 2) {
        heading.setAttribute(
          "class",
          "mt-12 mb-4 text-3xl font-semibold tracking-tight text-slate-900"
        );
      } else {
        heading.setAttribute(
          "class",
          "mt-8 mb-3 text-2xl font-semibold tracking-tight text-slate-800"
        );
      }
      headings.push({ id, label: text, level });

      const imageConfig = sectionImagesByHeading.get(normalizeHeadingLabel(text));
      if (imageConfig && imageConfig.imageUrl && !usedSectionImages.has(imageConfig.targetHeading)) {
        const figure = doc.createElement("figure");
        const image = doc.createElement("img");
        image.setAttribute("src", buildImageUrl(imageConfig.imageUrl));
        image.setAttribute("alt", imageConfig.altText || text);
        image.className = "h-full w-full rounded-[24px] object-contain";
        figure.appendChild(image);
        heading.insertAdjacentElement("afterend", figure);
        usedSectionImages.add(imageConfig.targetHeading);
      }
    });

    root?.querySelectorAll("a").forEach((anchor) => {
      if (anchor.querySelector("img")) {
        anchor.setAttribute("class", "block overflow-hidden rounded-[24px] transition hover:opacity-95");
      } else {
        anchor.setAttribute("class", "font-semibold text-sky-700 underline decoration-sky-300 underline-offset-4");
      }
      if (/^https?:\/\//i.test(anchor.getAttribute("href") || "")) {
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noreferrer");
      }
    });

    root?.querySelectorAll("table").forEach((table) => {
      table.setAttribute("class", "w-full border-collapse overflow-hidden rounded-2xl text-sm");
    });

    root?.querySelectorAll("th, td").forEach((cell) => {
      cell.setAttribute("class", "border border-slate-200 px-4 py-3 text-left");
    });

    root?.querySelectorAll("blockquote").forEach((quote) => {
      quote.setAttribute("class", "border-l-4 border-sky-400 bg-sky-50/70 px-5 py-3 italic text-slate-700");
    });

    root?.querySelectorAll("figure").forEach((figure) => {
      figure.setAttribute("class", "my-8 overflow-hidden rounded-[24px]");

      const href = figure.getAttribute("data-href") || "";
      const image = figure.querySelector("img");

      if (href && image && !figure.querySelector("a")) {
        const anchor = doc.createElement("a");
        anchor.setAttribute("href", href);
        anchor.setAttribute("class", "block overflow-hidden rounded-[24px] transition hover:opacity-95");
        if (/^https?:\/\//i.test(href)) {
          anchor.setAttribute("target", "_blank");
          anchor.setAttribute("rel", "noreferrer");
        }
        image.replaceWith(anchor);
        anchor.appendChild(image);
      }
    });

    root?.querySelectorAll("img").forEach((image) => {
      const rawSrc = image.getAttribute("data-src") || image.getAttribute("src") || "";
      image.setAttribute("src", buildImageUrl(rawSrc));
      image.setAttribute("class", "h-full w-full rounded-[24px] object-contain");
      image.setAttribute("loading", "lazy");
    });

    return {
      headings,
      html: root?.innerHTML || "",
    };
  }, [blog?.content, blog?.sectionImages]);

  useEffect(() => {
    if (!blog) return;
    document.title = blog.metaTitle?.trim() || blog.title || "Maitrova Blog";
    setMetaTag("description", blog.metaDescription?.trim() || blog.excerpt || "");
    setMetaTag("keywords", blog.focusKeyword?.trim() || "");
  }, [blog]);

  const articleSchema = useMemo(() => {
    if (!blog) return null;

    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: blog.title,
      description: blog.metaDescription || blog.excerpt || "",
      image: blog.coverImage ? [buildImageUrl(blog.coverImage)] : undefined,
      author: {
        "@type": "Person",
        name: blog.authorName || "Maitrova Team",
      },
      publisher: {
        "@type": "Organization",
        name: "Maitrova",
      },
      datePublished: blog.publishedAt,
      dateModified: blog.updatedAt || blog.publishedAt,
      mainEntityOfPage: window.location.href,
    };
  }, [blog]);

  const faqSchema = useMemo(() => {
    if (!blog?.faqItems?.length) return null;

    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: blog.faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };
  }, [blog?.faqItems]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="mt-6 h-12 w-5/6 rounded bg-slate-200" />
          <div className="mt-8 aspect-[16/8] rounded-[28px] bg-slate-200" />
          <div className="mt-8 h-64 rounded-[28px] bg-slate-200" />
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
      {articleSchema ? <script type="application/ld+json">{JSON.stringify(articleSchema)}</script> : null}
      {faqSchema ? <script type="application/ld+json">{JSON.stringify(faqSchema)}</script> : null}

      <article className="mx-auto max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition hover:text-sky-800">
          <span>&larr;</span>
          <span>Back to Homepage</span>
        </Link>

        <header className="mt-6 rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_34px_90px_-48px_rgba(15,23,42,0.42)] sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">{blog.category}</span>
            {blog.isFeatured ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">Featured</span>
            ) : null}
            {blog.focusKeyword ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">{blog.focusKeyword}</span>
            ) : null}
          </div>

          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            {blog.title}
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{blog.authorName}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{formatDate(blog.publishedAt)}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{blog.readTimeMinutes} min read</span>
          </div>

          <div className="mt-7 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
            {blog.coverImage ? (
              <div className="flex aspect-[16/10] items-center justify-center px-4 py-4 sm:aspect-[16/9] sm:px-6 sm:py-5">
                <img
                  src={buildImageUrl(blog.coverImage)}
                  alt={blog.coverImageAlt || blog.title}
                  className="h-full w-full rounded-[18px] object-contain shadow-sm"
                />
              </div>
            ) : (
              <div className="h-[160px] w-full bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_34%),linear-gradient(135deg,_#e2e8f0,_#f8fafc_48%,_#e2e8f0)]" />
            )}
          </div>

          <p className="mt-8 max-w-3xl text-base leading-8 text-slate-600">
            {blog.excerpt}
          </p>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
  <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
    Contents
  </h2>

  {contentData.headings.length === 0 ? (
    <p className="mt-4 text-sm text-slate-500">
      Add H2 and H3 headings in the editor to generate the table of contents.
    </p>
  ) : (
    <div className="mt-4 space-y-2">
      {contentData.headings.map((heading) => (
        <div
          key={heading.id}
          className={`block text-sm text-slate-600 ${
            heading.level === 3 ? "pl-4" : ""
          }`}
        >
          {heading.label}
        </div>
      ))}
    </div>
  )}
</aside>

          <div className="space-y-8">
            <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
              <div
                className="prose prose-slate max-w-none prose-headings:scroll-mt-28 prose-p:leading-8 prose-li:leading-8 prose-img:rounded-[24px]"
                dangerouslySetInnerHTML={{ __html: contentData.html }}
              />
            </div>

            {blog.faqItems?.length ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-semibold text-slate-900">FAQs</h2>
                <div className="mt-6 space-y-4">
                  {blog.faqItems.map((item, index) => (
                    <div key={`${item.question}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
};

export default BlogDetailPage;
