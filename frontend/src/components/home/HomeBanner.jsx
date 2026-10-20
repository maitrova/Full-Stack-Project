import cx from "../ui/cx.js";

/**
 * Home page promo card. The uploaded photo IS the banner: it fills the whole card
 * (no background colour or overlay) and the copy + actions sit on its left side,
 * as in the approved reference. Design photos with a calm area on the left for text.
 * Without a photo the card is transparent with a hairline outline.
 *
 * image: URL of the uploaded banner photo (admin → Homepage → Homepage banners).
 */
const RATIOS = {
  // hero: ~16:9 on phones, ~16:7 from tablets up
  lg: "aspect-[16/9] sm:aspect-[16/7]",
  // promo banners: ~12:5 on phones, ~16:5 from tablets up
  md: "aspect-[12/5] sm:aspect-[16/5]",
};

const HomeBanner = ({ as = "h2", title, text, image, imageAlt = "", children, size = "md", className }) => {
  const Heading = as;
  const large = size === "lg";

  return (
    <div className={cx("relative rounded-mt-card", RATIOS[large ? "lg" : "md"], !image && "border border-mt-line", className)}>
      {image && (
        <div className="absolute inset-0 overflow-hidden rounded-mt-card">
          <img
            src={image}
            alt={imageAlt}
            className="h-full w-full object-cover object-right"
            loading={large ? "eager" : "lazy"}
            decoding="async"
          />
        </div>
      )}

      {/* Copy sits on the left of the photo; the card grows if the text needs more room. */}
      <div
        className={cx(
          "relative flex h-full max-w-[62%] flex-col justify-center sm:max-w-[50%]",
          large ? "gap-3 p-5 sm:gap-5 sm:p-10 lg:p-14" : "gap-2 p-4 sm:gap-4 sm:p-10"
        )}
      >
        <Heading
          className={cx(
            "text-mt-text",
            large ? "text-[26px] leading-[1.05] sm:text-5xl lg:text-6xl" : "text-[20px] leading-tight sm:text-4xl"
          )}
        >
          {title}
        </Heading>
        {text && (
          <p className={cx("max-w-md text-mt-banner-muted", large ? "hidden text-base sm:block" : "text-[11px] leading-snug sm:text-base")}>
            {text}
          </p>
        )}
        {children}
      </div>
    </div>
  );
};

export default HomeBanner;
