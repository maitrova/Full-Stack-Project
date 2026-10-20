import { Link } from "react-router-dom";
import cx from "./cx.js";

const SIZES = {
  sm: "text-lg",
  md: "text-[22px] sm:text-[26px]",
  lg: "text-[28px] sm:text-[34px]",
};

/** The MAITROVA wordmark (serif, spaced capitals) linking to the home page. */
const Wordmark = ({ size = "md", className, onClick }) => (
  <Link
    to="/"
    onClick={onClick}
    aria-label="MAITROVA home"
    className={cx(
      "inline-block font-display uppercase leading-none tracking-[0.18em] text-mt-text",
      "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mt-text",
      SIZES[size] || SIZES.md,
      className
    )}
  >
    Maitrova
  </Link>
);

export default Wordmark;
