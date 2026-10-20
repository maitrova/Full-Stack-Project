import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { ChevronRight, Undo2 } from "lucide-react";
import { undoCombo } from "../redux/slices/Cartslice.js";
import { getComboUnitSaving } from "../utils/comboSavings.js";
import { Link } from "react-router-dom";
import { buildImageUrl } from "../utils/responsiveImage.js";
import { buildReadymadeProductPath } from "../utils/readymadeRoutes.js";

const formatRupees = (value) =>
  `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

const getSelectionPath = (selection) =>
  selection?.productId
    ? buildReadymadeProductPath({ _id: selection.productId, title: selection.productName })
    : null;

// The combo's product pictures, e.g. [shirt] + [shorts], used as the cart
// line image: side by side on phones, stacked in a column on wider screens
// where the image column is narrow.
export const ComboImageCollage = ({ item }) => {
  const images = (item?.comboSelections || []).filter((selection) => selection.productImage);

  return (
    <div className="flex h-full w-full items-center gap-1 bg-mt-bg p-1.5 sm:flex-col sm:gap-1.5">
      {images.map((selection, index) => (
        <React.Fragment key={`${selection.productId}-${index}`}>
          {index > 0 ? (
            <span
              aria-hidden="true"
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-mt-surface text-xs font-bold text-mt-text shadow-sm"
            >
              +
            </span>
          ) : null}
          <img
            src={buildImageUrl(selection.productImage)}
            alt={selection.productName || ""}
            loading="lazy"
            className="h-full min-w-0 flex-1 rounded-md object-cover sm:aspect-square sm:h-auto sm:w-full sm:flex-none"
          />
        </React.Fragment>
      ))}
    </div>
  );
};

// Each product inside a combo line, so the customer sees exactly what they get.
export const ComboItemsList = ({ item }) => {
  const selections = Array.isArray(item?.comboSelections) ? item.comboSelections : [];
  if (item?.kind !== "COMBO" || !selections.length) return null;

  return (
    <div className="mb-3 rounded-lg border border-mt-line bg-mt-bg p-2 sm:p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-mt-subtle">
        {selections.length} products in this combo
      </p>
      <ul className="space-y-2">
        {selections.map((selection, index) => {
          const color = selection.color?.label || selection.color?.value;
          const details = [selection.size ? `Size ${selection.size}` : "", color ? `Color ${color}` : ""]
            .filter(Boolean)
            .join(" · ");
          const path = getSelectionPath(selection);
          const Row = path ? Link : "div";
          return (
            <li key={`${selection.productId || selection.productName}-${index}`}>
              <Row
                {...(path ? { to: path } : {})}
                className="group flex items-center gap-3 rounded-md p-1 -m-1 hover:bg-mt-tint/5"
              >
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-mt-surface-raised">
                  {selection.productImage ? (
                    <img
                      src={buildImageUrl(selection.productImage)}
                      alt={selection.productName || ""}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-mt-text group-hover:underline">
                    {selection.productName || `Item ${index + 1}`}
                  </p>
                  {details ? <p className="text-xs text-mt-subtle">{details}</p> : null}
                </div>
                {Number(selection.unitPrice) > 0 ? (
                  <span className="flex-shrink-0 text-xs text-mt-subtle">{formatRupees(selection.unitPrice)}</span>
                ) : null}
                {path ? <ChevronRight className="h-4 w-4 flex-shrink-0 text-mt-subtle" /> : null}
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const ComboSavingBadge = ({ item }) => {
  const saving = getComboUnitSaving(item) * Number(item.qty || 0);
  if (!(saving > 0)) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-mt-success/10 px-2.5 py-1 text-xs font-semibold text-mt-success">
        <span aria-hidden="true">🎁</span>
        Combo offer savings {formatRupees(saving)}
      </span>
      <span className="text-xs text-mt-subtle">
        <span className="line-through">{formatRupees(Number(item.basePrice || 0) * Number(item.qty || 0))}</span>{" "}
        if bought separately
      </span>
    </div>
  );
};

// "Remove combo, keep my item" for combos made from cart items. Asks first,
// since the customer gives up the combo saving.
export const ComboUndoControl = ({ item, onUndone }) => {
  const dispatch = useDispatch();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lastSet = item?.convertedFrom?.[item.convertedFrom.length - 1];
  if (item?.kind !== "COMBO" || !lastSet?.items?.length) return null;

  const keepTitles = lastSet.items.map((entry) => entry.title || "your item").join(" + ");
  const saving = getComboUnitSaving(item);

  const handleUndo = async () => {
    setBusy(true);
    setError("");
    const result = await dispatch(undoCombo(item._id));
    if (undoCombo.rejected.match(result)) {
      setError(result.payload?.message || "Could not remove the combo");
      setBusy(false);
      return;
    }
    // On success this line changes or disappears with the reloaded cart.
    onUndone?.(`Combo removed. ${result.payload?.restored?.join(" + ") || keepTitles} is back in your cart.`);
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-mt-line-strong bg-mt-surface px-3 py-2 text-sm font-medium text-mt-text hover:bg-mt-tint/5 sm:w-auto"
      >
        <Undo2 className="h-4 w-4" />
        <span className="truncate">Remove combo, keep {keepTitles}</span>
      </button>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-mt-line-strong bg-mt-bg p-3">
      <p className="text-sm text-mt-text">
        Go back to just <strong>{keepTitles}</strong>?
        {saving > 0 ? (
          <>
            {" "}You'll lose the <strong className="text-mt-success">{formatRupees(saving)}</strong> combo saving.
          </>
        ) : null}{" "}
        Items added only for this combo will be removed.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded-md bg-mt-btn px-4 py-2 text-sm font-semibold text-mt-btn-text hover:bg-mt-btn-hover disabled:opacity-60"
        >
          Keep combo
        </button>
        <button
          type="button"
          onClick={handleUndo}
          disabled={busy}
          className="rounded-md border border-mt-danger/40 px-4 py-2 text-sm font-medium text-mt-danger hover:bg-mt-danger/10 disabled:opacity-60"
        >
          {busy ? "Removing" : "Remove combo"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-mt-danger">{error}</p> : null}
    </div>
  );
};
