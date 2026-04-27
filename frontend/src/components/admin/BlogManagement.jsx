import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { selectCurrentToken } from "../../redux/slices/Userslice.js";
import { buildImageUrl } from "../../utils/responsiveImage.js";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend/api";

const emptyForm = {
  title: "",
  slug: "",
  category: "Insights",
  authorName: "Maitrova Team",
  excerpt: "",
  content: "",
  coverImage: "",
  coverImageFile: null,
  readTimeMinutes: 5,
  isPublished: true,
  isFeatured: false,
  publishedAt: "",
};

const formatDateInput = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
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

  const handleEdit = (blog) => {
    setEditingId(blog._id);
    setForm({
      title: blog.title || "",
      slug: blog.slug || "",
      category: blog.category || "Insights",
      authorName: blog.authorName || "Maitrova Team",
      excerpt: blog.excerpt || "",
      content: blog.content || "",
      coverImage: blog.coverImage || "",
      coverImageFile: null,
      readTimeMinutes: Number(blog.readTimeMinutes || 5),
      isPublished: Boolean(blog.isPublished),
      isFeatured: Boolean(blog.isFeatured),
      publishedAt: formatDateInput(blog.publishedAt),
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
      payload.append("readTimeMinutes", String(Number(form.readTimeMinutes || 5) || 5));
      payload.append("isPublished", String(Boolean(form.isPublished)));
      payload.append("isFeatured", String(Boolean(form.isFeatured)));
      payload.append("publishedAt", form.publishedAt || "");

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

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {editingId ? "Edit Blog" : "Create Blog"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Manage homepage-ready blog cards with internal detail pages.
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
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Title</label>
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
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Read Time</label>
              <input type="number" min="1" max="60" value={form.readTimeMinutes} onChange={(e) => handleChange("readTimeMinutes", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Published Date</label>
              <input type="date" value={form.publishedAt} onChange={(e) => handleChange("publishedAt", e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cover Image</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/avif"
                onChange={(e) => handleChange("coverImageFile", e.target.files?.[0] || null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-semibold file:text-slate-700 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
              <p className="mt-2 text-xs text-slate-500">
                Upload from admin and it will be stored on the server like other images.
              </p>
              {form.coverImage ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <img src={buildImageUrl(form.coverImage)} alt="Cover preview" className="h-48 w-full object-cover" />
                </div>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Excerpt</label>
              <textarea value={form.excerpt} onChange={(e) => handleChange("excerpt", e.target.value)} rows={3} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Content</label>
              <textarea value={form.content} onChange={(e) => handleChange("content", e.target.value)} rows={10} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-7 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100" />
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
                          <img src={buildImageUrl(blog.coverImage)} alt={blog.title} className="h-40 w-full object-cover" />
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
