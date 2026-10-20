import React, { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Save, Trash2, Upload } from "lucide-react";
import { useSelector } from "react-redux";
import { selectCurrentToken } from "../../redux/slices/Userslice.js";
import { EMPTY_BANNERS, toBannerProps } from "../../hooks/useHomepageBanners.js";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend/api";
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/avif"];

const SLOTS = [
  {
    id: "hero",
    title: "Hero",
    where: "Top of the home page. The photo fills the whole banner; “Your style. Your signature.” sits on its left.",
    size: "2000 × 875 px (16:7). Keep the left half calm and light for the text; on phones the left edge is trimmed slightly.",
    ratio: "aspect-[16/7]",
  },
  {
    id: "makeItYours",
    title: "Make it yours",
    where: "Banner with the colour dots and “Customize now”. The photo fills the whole banner.",
    size: "2000 × 625 px (16:5). Keep the left half calm and light for the text.",
    ratio: "aspect-[16/5]",
  },
  {
    id: "betterTogether",
    title: "Better together",
    where: "Combo packs banner with “Shop combo packs”. The photo fills the whole banner.",
    size: "2000 × 625 px (16:5). Keep the left half calm and light for the text.",
    ratio: "aspect-[16/5]",
  },
];

function BannerSlotCard({ slot, current, token, onSaved }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  // null = show the saved alt text; a string = the admin is editing it.
  const [altDraft, setAltDraft] = useState(null);
  const alt = altDraft ?? current.alt;
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const inputRef = useRef(null);

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const pickFile = (event) => {
    const picked = event.target.files?.[0];
    if (!picked) return;
    if (!ACCEPTED.includes(picked.type)) {
      setFeedback({ type: "error", message: "Please choose a PNG, JPG, WebP or AVIF image." });
      event.target.value = "";
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFeedback({ type: "error", message: "That image is larger than 8 MB." });
      event.target.value = "";
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setFeedback({ type: "", message: "" });
  };

  const resetPick = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const save = async () => {
    setBusy(true);
    setFeedback({ type: "", message: "" });
    try {
      const form = new FormData();
      if (file) form.append("image", file);
      form.append("alt", alt);
      const res = await fetch(`${API_URL}/homepage-banners/admin/${slot.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to save banner");
      resetPick();
      setAltDraft(null);
      onSaved(data.banners);
      setFeedback({ type: "success", message: "Saved. The home page shows it on the next visit." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to save banner" });
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!window.confirm(`Remove the ${slot.title} photo? The banner will go back to its default look.`)) return;
    setBusy(true);
    setFeedback({ type: "", message: "" });
    try {
      const res = await fetch(`${API_URL}/homepage-banners/admin/${slot.id}/image`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to remove photo");
      resetPick();
      onSaved(data.banners);
      setFeedback({ type: "success", message: "Photo removed." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Failed to remove photo" });
    } finally {
      setBusy(false);
    }
  };

  const shownImage = previewUrl || current.image;
  const inputId = `banner-file-${slot.id}`;
  const altId = `banner-alt-${slot.id}`;
  const dirty = Boolean(file) || alt !== current.alt;

  return (
    <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h4 className="text-base font-semibold text-slate-900">{slot.title}</h4>
        <p className="mt-1 text-xs text-slate-600">{slot.where}</p>
      </div>

      <div className={`relative ${slot.ratio} overflow-hidden rounded-2xl border border-slate-200 bg-slate-100`}>
        {shownImage ? (
          <img src={shownImage} alt={alt || `${slot.title} banner preview`} className="h-full w-full object-cover object-right" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
            <ImageIcon className="h-8 w-8" aria-hidden="true" />
            <span className="text-xs">No photo yet</span>
          </div>
        )}
        {previewUrl && (
          <span className="absolute left-3 top-3 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            Not saved yet
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">{slot.size}</p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor={inputId} className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">
            <Upload className="h-4 w-4" aria-hidden="true" />
            {current.image || previewUrl ? "Choose a different photo" : "Choose photo"}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            onChange={pickFile}
            className="sr-only"
          />
          {file && (
            <button type="button" onClick={resetPick} className="ml-3 text-xs font-medium text-slate-500 underline hover:text-slate-700">
              Cancel
            </button>
          )}
        </div>

        <div>
          <label htmlFor={altId} className="text-xs font-medium text-slate-700">
            Image description (alt text)
          </label>
          <input
            id={altId}
            type="text"
            value={alt}
            maxLength={160}
            onChange={(event) => setAltDraft(event.target.value)}
            placeholder="e.g. Cream hoodie and black sun tee on stone"
            className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </div>

        {feedback.message && (
          <p className={`text-xs font-medium ${feedback.type === "error" ? "text-rose-600" : "text-emerald-700"}`} role="status">
            {feedback.message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {busy ? "Saving…" : "Save"}
          </button>
          {current.image && (
            <button
              type="button"
              onClick={removePhoto}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Admin → Homepage → upload the three home page banner photos. */
export default function HomepageBannersManager() {
  const token = useSelector(selectCurrentToken);
  const [banners, setBanners] = useState(EMPTY_BANNERS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/homepage-banners`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Failed to load banners");
        if (!cancelled) setBanners(toBannerProps(data));
      })
      .catch((error) => !cancelled && setLoadError(error.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Storefront</p>
      <h3 className="mt-2 text-2xl font-semibold text-slate-900">Homepage banners</h3>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Each photo fills its whole banner (no background colour is added), with the text placed on the left. PNG, JPG, WebP or AVIF, up to 8 MB.
      </p>

      {loadError && <p className="mt-4 text-sm text-rose-600">{loadError}</p>}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {loading
          ? SLOTS.map((slot) => <div key={slot.id} className="h-96 animate-pulse rounded-3xl bg-slate-100" />)
          : SLOTS.map((slot) => (
              <BannerSlotCard
                key={slot.id}
                slot={slot}
                current={banners[slot.id]}
                token={token}
                onSaved={(next) => next && setBanners(toBannerProps(next))}
              />
            ))}
      </div>
    </section>
  );
}
