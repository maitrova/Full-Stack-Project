import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Repeat } from "lucide-react";
import { convertToCombo } from "../redux/slices/Cartslice.js";
import { buildImageUrl } from "../utils/responsiveImage.js";
import { buildComboFromCartPath } from "../utils/comboCartLink.js";

const formatRupees = (value) =>
  `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;

// Cart items the combo reuses, as convert-to-combo selections.
const matchedSelections = (suggestion) =>
  suggestion.matched.map(({ slotId, itemId }) => ({ slotId, itemId }));

const joinTitles = (matched) => matched.map((entry) => entry.title).filter(Boolean).join(" + ");

const useConvert = (suggestion, onConverted) => {
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const convert = async (extraSelections = []) => {
    setBusy(true);
    setError("");
    const result = await dispatch(
      convertToCombo({
        comboPackId: suggestion.comboId,
        selections: [...matchedSelections(suggestion), ...extraSelections],
      })
    );
    if (convertToCombo.rejected.match(result)) {
      setError(result.payload?.message || "Could not switch to the combo");
      setBusy(false);
      return;
    }
    // On success the cart reloads and this suggestion disappears.
    onConverted?.(`Switched to ${suggestion.comboName}. You save ${formatRupees(result.payload?.savings)}.`);
  };

  return { busy, error, convert };
};

const CandidateCard = ({ candidate, slotId, disabled, onAdd }) => {
  const [size, setSize] = useState(candidate.sizes?.[0]?.size || "");
  const selected = candidate.sizes?.find((entry) => entry.size === size) || candidate.sizes?.[0];
  const imageUrl = candidate.image ? buildImageUrl(candidate.image) : null;
  const hasSizes = candidate.sizes?.some((entry) => entry.size);

  return (
    <div className="flex w-40 flex-shrink-0 flex-col rounded-lg border border-mt-line bg-mt-surface p-2 sm:w-44">
      <div className="aspect-square w-full overflow-hidden rounded-md bg-mt-surface-raised">
        {imageUrl ? (
          <img src={imageUrl} alt={candidate.title} loading="lazy" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <p className="mt-2 line-clamp-2 text-xs font-medium text-mt-text">{candidate.title}</p>
      <span className="mt-1 text-sm font-semibold text-mt-text">{formatRupees(selected?.price)}</span>
      <span className="mt-1 w-fit rounded-full bg-mt-success/10 px-2 py-0.5 text-[10px] font-semibold text-mt-success">
        Save {formatRupees(selected?.savings)}
      </span>
      <div className="mt-auto flex items-center gap-1 pt-2">
        {hasSizes ? (
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-mt-line-strong px-1 py-1 text-xs"
            aria-label={`Size for ${candidate.title}`}
          >
            {candidate.sizes.map((entry) => (
              <option key={entry.size} value={entry.size}>
                {entry.size}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={() => onAdd({ slotId, productId: candidate._id, size: selected?.size || "" })}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-mt-btn px-2 py-1 text-xs font-semibold text-mt-btn-text hover:bg-mt-btn-hover disabled:opacity-60"
        >
          <Plus className="h-3 w-3" />
          {disabled ? "Adding" : "Add"}
        </button>
      </div>
    </div>
  );
};

const AddOneOffer = ({ suggestion, onConverted }) => {
  const { busy, error, convert } = useConvert(suggestion, onConverted);
  const missing = suggestion.missingSlots[0];
  const bestSaving = Math.max(
    ...suggestion.candidates.flatMap((candidate) => candidate.sizes.map((entry) => entry.savings))
  );

  return (
    <>
      <p className="text-sm text-mt-text">
        Your <strong>{joinTitles(suggestion.matched)}</strong> is part of{" "}
        <strong>{suggestion.comboName}</strong>. Add one {missing.label ? <strong>{missing.label}</strong> : "more item"}{" "}
        and save up to <strong className="text-mt-success">{formatRupees(bestSaving)}</strong>.
      </p>
      <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-2">
        {suggestion.candidates.map((candidate) => (
          <CandidateCard
            key={candidate._id}
            candidate={candidate}
            slotId={missing.slotId}
            disabled={busy}
            onAdd={(selection) => convert([selection])}
          />
        ))}
      </div>
      {error ? <p className="mt-1 text-xs text-mt-danger">{error}</p> : null}
    </>
  );
};

const SwitchOffer = ({ suggestion, onConverted }) => {
  const { busy, error, convert } = useConvert(suggestion, onConverted);

  return (
    <>
      <p className="text-sm text-mt-text">
        You already have everything in <strong>{suggestion.comboName}</strong> (
        {joinTitles(suggestion.matched)}). Switch to the combo and save{" "}
        <strong className="text-mt-success">{formatRupees(suggestion.savings)}</strong>.
      </p>
      <button
        type="button"
        onClick={() => convert()}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-mt-btn px-3 py-1.5 text-sm font-semibold text-mt-btn-text hover:bg-mt-btn-hover disabled:opacity-60"
      >
        <Repeat className="h-4 w-4" />
        {busy ? "Switching" : `Switch & save ${formatRupees(suggestion.savings)}`}
      </button>
      {error ? <p className="mt-2 text-xs text-mt-danger">{error}</p> : null}
    </>
  );
};

const CompleteOffer = ({ suggestion }) => {
  const missingLabels = suggestion.missingSlots.map((slot) => slot.label || "item").join(" + ");

  return (
    <>
      <p className="text-sm text-mt-text">
        Your <strong>{joinTitles(suggestion.matched)}</strong> is part of{" "}
        <strong>{suggestion.comboName}</strong>. Add a <strong>{missingLabels}</strong> to save up to{" "}
        <strong className="text-mt-success">{formatRupees(suggestion.savings)}</strong>.
      </p>
      <Link
        to={buildComboFromCartPath(suggestion.comboSlug, suggestion.matched)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-mt-btn px-3 py-1.5 text-sm font-semibold text-mt-btn-text hover:bg-mt-btn-hover"
      >
        Complete combo
        <ArrowRight className="h-4 w-4" />
      </Link>
    </>
  );
};

const OFFER_BY_TYPE = {
  ADD_ONE: AddOneOffer,
  SWITCH: SwitchOffer,
  COMPLETE: CompleteOffer,
};

const ComboOffersPanel = ({ suggestions = [], onConverted }) => {
  const offers = suggestions.filter((suggestion) => OFFER_BY_TYPE[suggestion.type]);
  if (!offers.length) return null;

  return (
    <div className="mb-4 rounded-xl bg-mt-surface p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">🎁</span>
        <h2 className="text-lg font-normal text-mt-text">Combo offer savings</h2>
      </div>
      <div className="mt-4 divide-y divide-mt-line">
        {offers.map((suggestion) => {
          const Offer = OFFER_BY_TYPE[suggestion.type];
          return (
            <div key={`${suggestion.comboId}:${suggestion.type}`} className="py-4 first:pt-0 last:pb-0">
              <Offer suggestion={suggestion} onConverted={onConverted} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComboOffersPanel;
