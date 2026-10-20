import { useEffect, useState } from "react";
import { buildImageUrl } from "../utils/responsiveImage.js";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/backend/api";

export const EMPTY_BANNERS = {
  hero: { image: "", alt: "" },
  makeItYours: { image: "", alt: "" },
  betterTogether: { image: "", alt: "" },
};

// Turns the API response into ready-to-use image URLs ("" when no photo yet).
export const toBannerProps = (data) =>
  Object.keys(EMPTY_BANNERS).reduce((acc, slot) => {
    const entry = data?.[slot] || {};
    acc[slot] = {
      image: entry.image ? buildImageUrl(entry.image) : "",
      alt: String(entry.alt || ""),
    };
    return acc;
  }, {});

/** Homepage banner photos uploaded in admin (Homepage → Homepage banners). */
const useHomepageBanners = () => {
  const [banners, setBanners] = useState(EMPTY_BANNERS);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/homepage-banners`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setBanners(toBannerProps(data));
      })
      .catch(() => {
        // Banners are optional: keep the default look if the request fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return banners;
};

export default useHomepageBanners;
