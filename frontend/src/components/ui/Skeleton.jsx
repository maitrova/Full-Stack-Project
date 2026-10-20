import cx from "./cx.js";

/** Loading placeholder block. Size it with className, e.g. "h-40 w-full". */
const Skeleton = ({ className, rounded = "card" }) => (
  <div
    aria-hidden="true"
    className={cx(
      "animate-pulse bg-mt-surface-raised",
      rounded === "full" ? "rounded-full" : "rounded-mt-card",
      className
    )}
  />
);

export default Skeleton;
