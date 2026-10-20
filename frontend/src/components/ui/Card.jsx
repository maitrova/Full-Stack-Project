import cx from "./cx.js";

const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-7",
};

/** Dark surface panel with a hairline border (the "Make it yours" box style). */
const Card = ({ as, padding = "md", interactive = false, className, children, ...rest }) => {
  const Tag = as || "div";

  return (
    <Tag
      className={cx(
        "rounded-mt-card border border-mt-line bg-mt-surface text-mt-text",
        PADDING[padding] ?? PADDING.md,
        interactive && "transition-colors hover:border-mt-line-strong",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export default Card;
