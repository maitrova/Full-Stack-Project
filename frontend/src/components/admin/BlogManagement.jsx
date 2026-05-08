import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { selectCurrentToken } from "../../redux/slices/Userslice.js";
import { buildImageUrl } from "../../utils/responsiveImage.js";
import BlogRichTextEditor from "./BlogRichTextEditor.jsx";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend/api";

const createEmptySectionImage = () => ({
  imageUrl: "",
  altText: "",
  targetHeading: "",
});

const createEmptyFaq = () => ({
  question: "",
  answer: "",
});

const emptyForm = {
  title: "",
  slug: "",
  category: "Insights",
  authorName: "Maitrova Team",
  excerpt: "",
  content: "",
  coverImage: "",
  coverImageAlt: "",
  coverImageFile: null,
  metaTitle: "",
  metaDescription: "",
  focusKeyword: "",
  isPublished: true,
  isFeatured: false,
  publishedAt: "",
  sectionImages: [
    createEmptySectionImage(),
    createEmptySectionImage(),
    createEmptySectionImage(),
  ],
  faqItems: [createEmptyFaq(), createEmptyFaq()],
};

const formatDateInput = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const normalizeEditorContent = (value) => {
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

const estimateReadTime = (value) => {
  const plainText = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = plainText ? plainText.split(" ").length : 0;
  return Math.max(1, Math.ceil(words / 200));
};

const BlogManagement = () => {
  const token = useSelector(selectCurrentToken);
  const [blogs, setBlogs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const estimatedReadTime = useMemo(() => estimateReadTime(form.content), [form.content]);

  const loadBlogs = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_URL}/blogs/admin`, {
        headers: authHeaders,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to load blogs");
      }
      setBlogs(Array.isArray(data?.blogs) ? data.blogs : []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load blogs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadBlogs();
  }, [token]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleChange = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateSectionImage = (index, key, value) => {
    setForm((current) => ({
      ...current,
      sectionImages: current.sectionImages.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const updateFaq = (index, key, value) => {
    setForm((current) => ({
      ...current,
      faqItems: current.faqItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addSectionImage = () => {
    setForm((current) => ({
      ...current,
      sectionImages: [...current.sectionImages, createEmptySectionImage()],
    }));
  };

  const addFaq = () => {
    setForm((current) => ({
      ...current,
      faqItems: [...current.faqItems, createEmptyFaq()],
    }));
  };

  const handleEdit = (blog) => {
    setEditingId(blog._id);
    setForm({
      title: blog.title || "",
      slug: blog.slug || "",
      category: blog.category || "Insights",
      authorName: blog.authorName || "Maitrova Team",
      excerpt: blog.excerpt || "",
      content: normalizeEditorContent(blog.content || ""),
      coverImage: blog.coverImage || "",
      coverImageAlt: blog.coverImageAlt || "",
      coverImageFile: null,
      metaTitle: blog.metaTitle || "",
      metaDescription: blog.metaDescription || "",
      focusKeyword: blog.focusKeyword || "",
      isPublished: Boolean(blog.isPublished),
      isFeatured: Boolean(blog.isFeatured),
      publishedAt: formatDateInput(blog.publishedAt),
      sectionImages: Array.isArray(blog.sectionImages) && blog.sectionImages.length > 0
        ? blog.sectionImages.map((item) => ({
            imageUrl: item?.imageUrl || "",
            altText: item?.altText || "",
            targetHeading: item?.targetHeading || "",
          }))
        : [createEmptySectionImage(), createEmptySectionImage(), createEmptySectionImage()],
      faqItems: Array.isArray(blog.faqItems) && blog.faqItems.length > 0
        ? blog.faqItems.map((item) => ({
            question: item?.question || "",
            answer: item?.answer || "",
          }))
        : [createEmptyFaq(), createEmptyFaq()],
    });
    setSuccess("");
    setError("");
  };

  const handleDelete = async (blogId) => {
    if (!window.confirm("Delete this blog?")) return;

    try {
      setError("");
      setSuccess("");
      const response = await fetch(`${API_URL}/blogs/admin/${blogId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to delete blog");
      }
      setSuccess("Blog deleted successfully.");
      if (editingId === blogId) resetForm();
      await loadBlogs();
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete blog");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = new FormData();
      payload.append("title", form.title || "");
      payload.append("slug", form.slug || "");
      payload.append("category", form.category || "");
      payload.append("authorName", form.authorName || "");
      payload.append("excerpt", form.excerpt || "");
      payload.append("content", form.content || "");
      payload.append("coverImage", form.coverImage || "");
      payload.append("coverImageAlt", form.coverImageAlt || "");
      payload.append("metaTitle", form.metaTitle || "");
      payload.append("metaDescription", form.metaDescription || "");
      payload.append("focusKeyword", form.focusKeyword || "");
      payload.append("isPublished", String(Boolean(form.isPublished)));
      payload.append("isFeatured", String(Boolean(form.isFeatured)));
      payload.append("publishedAt", form.publishedAt || "");
      payload.append(
        "sectionImages",
        JSON.stringify(
          form.sectionImages.filter((item) => item.imageUrl.trim() && item.targetHeading.trim())
        )
      );
      payload.append(
        "faqItems",
        JSON.stringify(
          form.faqItems.filter((item) => item.question.trim() && item.answer.trim())
        )
      );

      if (form.coverImageFile) {
        payload.append("coverImageFile", form.coverImageFile);
      }

      const response = await fetch(
        editingId ? `${API_URL}/blogs/admin/${editingId}` : `${API_URL}/blogs/admin`,
        {
          method: editingId ? "PUT" : "POST",
          headers: authHeaders,
          body: payload,
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to save blog");
      }

      setSuccess(editingId ? "Blog updated successfully." : "Blog created successfully.");
      resetForm();
      await loadBlogs();
    } catch (saveError) {
      setError(saveError.message || "Failed to save blog");
    } finally {
      setSaving(false);
    }
  };

  const handleInlineImageUpload = async (file) => {
    console.log("[BlogManagement] handleInlineImageUpload file:", file);
    const payload = new FormData();
    payload.append("inlineImageFile", file);

    const response = await fetch(`${API_URL}/blogs/admin/upload-image`, {
      method: "POST",
      headers: authHeaders,
      body: payload,
    });

    const data = await response.json();
    console.log("[BlogManagement] inline image upload response:", response.status, data);
    if (!response.ok) {
      throw new Error(data?.message || "Failed to upload inline image");
    }

    return data?.image?.url || "";
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{editingId ? "Edit Blog" : "Create Blog"}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Build structured blog pages with one H1 title, H2/H3 content, SEO metadata, FAQs, and section image placements.
              </p>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Title / Only H1</label>
              <input value={form.title} onChange={(e) => handleChange("title", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Slug</label>
              <input value={form.slug} onChange={(e) => handleChange("slug", e.target.value)} placeholder="auto-from-title" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Category</label>
              <input value={form.category} onChange={(e) => handleChange("category", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Author Name</label>
              <input value={form.authorName} onChange={(e) => handleChange("authorName", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Published Date</label>
              <input type="date" value={form.publishedAt} onChange={(e) => handleChange("publishedAt", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Focus Keyword</label>
              <input value={form.focusKeyword} onChange={(e) => handleChange("focusKeyword", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Auto Read Time</label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {estimatedReadTime} min read
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">SEO Meta Title</label>
              <input value={form.metaTitle} onChange={(e) => handleChange("metaTitle", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">SEO Meta Description</label>
              <textarea value={form.metaDescription} onChange={(e) => handleChange("metaDescription", e.target.value)} rows={2} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Hero Image</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/avif"
                onChange={(e) => handleChange("coverImageFile", e.target.files?.[0] || null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-semibold file:text-slate-700 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
              <p className="mt-2 text-xs text-slate-500">Upload the hero image shown above the introduction paragraph.</p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Hero Image Alt Text</label>
              <input value={form.coverImageAlt} onChange={(e) => handleChange("coverImageAlt", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
              {form.coverImage ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <img src={buildImageUrl(form.coverImage)} alt={form.coverImageAlt || "Cover preview"} className="h-48 w-full object-cover" />
                </div>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Excerpt</label>
              <textarea value={form.excerpt} onChange={(e) => handleChange("excerpt", e.target.value)} rows={3} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Content</label>
              <p className="mb-3 text-xs text-slate-500">Use the title as the only H1. Inside content, use H2 and H3 so the TOC and section nesting can be generated automatically. Upload inline images from the editor and optionally give each image its own redirect link.</p>
              <BlogRichTextEditor
                value={form.content}
                onChange={(value) => handleChange("content", value)}
                onImageUpload={handleInlineImageUpload}
              />
            </div>

            <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Section Images</h3>
                  <p className="mt-1 text-xs text-slate-500">Add image URLs and the exact H2 heading text after which each image should appear.</p>
                </div>
                <button type="button" onClick={addSectionImage} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                  Add Image Slot
                </button>
              </div>

              <div className="space-y-4">
                {form.sectionImages.map((item, index) => (
                  <div key={`section-image-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                    <input value={item.targetHeading} onChange={(e) => updateSectionImage(index, "targetHeading", e.target.value)} placeholder="Target H2 heading text" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
                    <input value={item.altText} onChange={(e) => updateSectionImage(index, "altText", e.target.value)} placeholder="Image alt text" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
                    <div className="md:col-span-2">
                      <input value={item.imageUrl} onChange={(e) => updateSectionImage(index, "imageUrl", e.target.value)} placeholder="Image URL or stored path" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">FAQs</h3>
                  <p className="mt-1 text-xs text-slate-500">These entries are rendered on the page and exported as FAQ schema.</p>
                </div>
                <button type="button" onClick={addFaq} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                  Add FAQ
                </button>
              </div>

              <div className="space-y-4">
                {form.faqItems.map((item, index) => (
                  <div key={`faq-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <input value={item.question} onChange={(e) => updateFaq(index, "question", e.target.value)} placeholder="Question" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
                    <textarea value={item.answer} onChange={(e) => updateFaq(index, "answer", e.target.value)} placeholder="Answer" rows={3} className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => handleChange("isPublished", e.target.checked)} />
              Publish on site
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => handleChange("isFeatured", e.target.checked)} />
              Mark as featured
            </label>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : editingId ? "Update Blog" : "Create Blog"}
            </button>
          </div>
        </form>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Existing Blogs</h2>
            <p className="mt-1 text-sm text-slate-600">Control what appears on the homepage and what remains in draft.</p>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Loading blogs...</div>
          ) : blogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No blogs created yet.
            </div>
          ) : (
            <div className="space-y-4">
              {blogs.map((blog) => (
                <div key={blog._id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {blog.coverImage ? (
                        <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200">
                          <img src={buildImageUrl(blog.coverImage)} alt={blog.coverImageAlt || blog.title} className="h-40 w-full object-cover" />
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{blog.category}</span>
                        <span className={`rounded-full px-2.5 py-1 ${blog.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {blog.isPublished ? "Published" : "Draft"}
                        </span>
                        {blog.isFeatured ? (
                          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Featured</span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-slate-900">{blog.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{blog.excerpt}</p>
                      <div className="mt-3 text-xs text-slate-500">
                        {blog.authorName} | {blog.readTimeMinutes} min | {formatDateInput(blog.publishedAt)}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => handleEdit(blog)} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(blog._id)} className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlogManagement;
