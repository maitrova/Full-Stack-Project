import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import cx from "./cx.js";
import Swatch from "./Swatch.jsx";

const formatPrice = (price) => {
  if (price === null || price === undefined || price === "") return null;
  if (typeof price === "string" && Number.isNaN(Number(price))) return price;
  return `₹${Number(price).toLocaleString("en-IN")}`;
};

/**
 * Product tile: photo, optional badge + wishlist heart, name, price, colours.
 * Prices may be numbers (formatted as ₹1,299) or ready-made strings.
 */
const ProductCard = ({
  to,
  image,
  imageAlt,
  name,
  price,
  compareAtPrice,
  badge,
  colors,
  wishlisted = false,
  onToggleWishlist,
  aspect = "aspect-[4/5]",
  className,
}) => {
  const formattedPrice = formatPrice(price);
  const formattedCompare = formatPrice(compareAtPrice);

  return (
    <div className={cx("group relative flex flex-col gap-2 font-brand text-mt-text", className)}>
      <div className={cx("relative overflow-hidden rounded-mt-btn bg-mt-surface-raised", aspect)}>
        {image && (
          <img
            src={image}
            alt={imageAlt ?? name ?? ""}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
        {badge && (
          <span className="absolute left-2.5 top-2.5 rounded-mt-btn bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {badge}
          </span>
        )}
        {onToggleWishlist && (
          <button
            type="button"
            onClick={onToggleWishlist}
            aria-label={wishlisted ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
            aria-pressed={wishlisted}
            className="absolute right-1.5 top-1.5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-white"
          >
            <Heart className={cx("h-4 w-4", wishlisted && "fill-current")} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Link
          to={to}
          className="text-sm leading-snug text-mt-text after:absolute after:inset-0 after:content-[''] focus-visible:outline-none sm:text-[15px]"
        >
          {name}
        </Link>
        {formattedPrice && (
          <div className="flex items-baseline gap-2 text-sm">
            <span className="text-mt-muted">{formattedPrice}</span>
            {formattedCompare && (
              <span className="text-xs text-mt-subtle line-through">{formattedCompare}</span>
            )}
          </div>
        )}
        {colors?.length > 0 && <Swatch colors={colors} size="sm" className="pt-1" />}
      </div>
    </div>
  );
};

export default ProductCard;
