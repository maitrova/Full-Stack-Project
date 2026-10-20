import cx from "./cx.js";

/** Centered message for empty carts, no results, no orders, etc. */
const EmptyState = ({ icon: Icon, title, description, action, className }) => (
  <div
    className={cx(
      "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center font-brand",
      className
    )}
  >
    {Icon && (
      <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-mt-surface-raised text-mt-muted">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
    )}
    {title && <h3 className="text-lg font-medium text-mt-text">{title}</h3>}
    {description && <p className="max-w-sm text-sm text-mt-muted">{description}</p>}
    {action && <div className="pt-2">{action}</div>}
  </div>
);

export default EmptyState;
