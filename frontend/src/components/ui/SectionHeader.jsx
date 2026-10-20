import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import cx from "./cx.js";

const actionClasses =
  "inline-flex shrink-0 items-center gap-1.5 py-2 text-xs text-mt-accent transition-colors hover:text-mt-accent-strong sm:text-sm";

/**
 * Section title row: "Shop by category ........ View all →".
 * Optional `eyebrow` renders the spaced caps line above ("MADE PERSONAL").
 */
const SectionHeader = ({
  title,
  eyebrow,
  actionLabel = "View all",
  actionTo,
  onAction,
  as,
  className,
}) => {
  const Heading = as || "h2";

  return (
    <div className={cx("flex items-end justify-between gap-4 font-brand", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && (
          <span className="text-[11px] uppercase tracking-eyebrow text-mt-muted">{eyebrow}</span>
        )}
        <Heading className="text-[22px] font-normal leading-tight text-mt-text sm:text-3xl">{title}</Heading>
      </div>
      {actionTo ? (
        <Link to={actionTo} className={actionClasses}>
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : (
        onAction && (
          <button type="button" onClick={onAction} className={actionClasses}>
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )
      )}
    </div>
  );
};

export default SectionHeader;
