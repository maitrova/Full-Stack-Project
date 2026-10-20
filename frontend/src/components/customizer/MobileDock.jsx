import cx from "../ui/cx.js";

/**
 * Phone / tablet bottom dock for the customizer: a row of tool buttons that open
 * the tools sheet, and the price with the save / cart actions under it.
 *
 * tools: [{ key, label, icon }]; activeKey is the tool whose sheet is open.
 */
const MobileDock = ({ tools = [], activeKey, onTool, price, caption, children }) => (
  <div className="fixed inset-x-0 bottom-0 z-40 border-t border-mt-line bg-mt-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
    <nav aria-label="Design tools" className="mx-auto grid max-w-xl grid-cols-4 border-b border-mt-line">
      {tools.map(({ key, label, icon }) => {
        const Icon = icon;
        const active = activeKey === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onTool(key)}
            aria-pressed={active}
            className={cx(
              "flex h-14 flex-col items-center justify-center gap-1 text-[11px] transition-colors",
              active ? "text-mt-text" : "text-mt-muted"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className={cx(active && "font-medium")}>{label}</span>
          </button>
        );
      })}
    </nav>
    <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium leading-tight tabular-nums text-mt-text">{price}</p>
        {caption && <p className="truncate text-[11px] text-mt-subtle">{caption}</p>}
      </div>
      {children}
    </div>
  </div>
);

export default MobileDock;
