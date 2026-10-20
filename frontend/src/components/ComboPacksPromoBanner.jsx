import React from "react";
import { Button } from "./ui/index.js";
import HomeBanner from "./home/HomeBanner.jsx";

/** "Better together" promo card linking to combo packs. */
const ComboPacksPromoBanner = ({ image, imageAlt = "MAITROVA combo pack" }) => {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 sm:pt-5">
      <HomeBanner
        title="Better together"
        text="Curated combinations for a complete look."
        image={image}
        imageAlt={imageAlt}
      >
        <div className="pt-1">
          <Button to="/combo-packs" variant="banner" arrow className="h-8 px-3 text-[11px] sm:h-11 sm:px-5 sm:text-sm">
            Shop combo packs
          </Button>
        </div>
      </HomeBanner>
    </section>
  );
};

export default ComboPacksPromoBanner;
