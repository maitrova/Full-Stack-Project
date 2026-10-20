import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import cx from "./cx.js";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: closes on Escape or backdrop click, locks page scroll,
 * keeps Tab focus inside, and returns focus to the trigger when closed.
 */
const Modal = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  className,
}) => {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const firstFocusable = dialog?.querySelector(FOCUSABLE);
    (firstFocusable || dialog)?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          "relative flex max-h-[90vh] w-full flex-col overflow-hidden font-brand text-mt-text",
          "rounded-t-mt-card border border-mt-line bg-mt-surface shadow-2xl sm:rounded-mt-card",
          "focus:outline-none",
          SIZES[size] || SIZES.md,
          className
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-mt-line px-5 py-4">
          {title ? (
            <h2 id={titleId} className="text-lg font-medium">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-mt-btn text-mt-muted hover:bg-mt-tint/10 hover:text-mt-text focus-visible:outline-2 focus-visible:outline-mt-text"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-3 border-t border-mt-line px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
