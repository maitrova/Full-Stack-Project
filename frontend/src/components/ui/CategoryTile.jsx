import { Link } from "react-router-dom";
import cx from "./cx.js";

/** Photo tile with the label in the bottom-left corner ("Oversized Tees"). */
const CategoryTile = ({
  to,
  image,
  imageAlt = "",
  label,
  aspect = "aspect-[5/4]",
  className,
  ...rest
}) => (
  <Link
    to={to}
    className={cx(
      "group relative block overflow-hidden rounded-mt-btn bg-mt-surface-raised font-brand",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mt-text",
      aspect,
      className
    )}
    {...rest}
  >
    {image && (
      <img
        src={image}
        alt={imageAlt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    )}
    <span
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-b from-transparent to-black/65"
    />
    <span className="absolute bottom-2.5 left-3 text-[13px] text-white sm:bottom-4 sm:left-4 sm:text-base">
      {label}
    </span>
  </Link>
);

export default CategoryTile;
