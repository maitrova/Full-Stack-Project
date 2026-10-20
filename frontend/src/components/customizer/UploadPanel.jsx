import { useState } from "react";
import { Crop, ImagePlus, Loader2, Trash2, Wand2 } from "lucide-react";
import cx from "../ui/cx.js";
import { LayerChips, PanelHeading, Segmented, SliderRow, ToolButton } from "./controls.jsx";

const pct = (value) => `${Math.round(Number(value || 0) * 100)}%`;
const inches = (value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(1) : "–");

/**
 * "Upload" tool: drop zone, the images on this side, and the editor for the
 * selected image. All actions are DesignerPage handlers passed in as props.
 */
const UploadPanel = ({
  accept,
  formatsLabel,
  onUpload,
  layers = [],
  activeDesign,
  onSelectLayer,
  libraryName,
  onScale,
  onScaleX,
  onScaleY,
  onNudge,
  onRemoveBackground,
  removingBackground,
  onCrop,
  onDelete,
  zones = [],
  activeZone,
  onZoneChange,
}) => {
  const [dragging, setDragging] = useState(false);
  const [stretch, setStretch] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer?.files;
    if (files?.length) onUpload({ target: { files, value: "" } });
  };

  const scaleX = activeDesign?.scaleX ?? activeDesign?.scale ?? 0.35;
  const scaleY = activeDesign?.scaleY ?? activeDesign?.scale ?? 0.35;

  return (
    <div className="space-y-5">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-mt-card border border-dashed px-4 py-6 text-center transition-colors",
          dragging ? "border-mt-text bg-mt-tint/10" : "border-mt-line-strong bg-mt-bg hover:border-mt-text"
        )}
      >
        <ImagePlus className="h-6 w-6 text-mt-muted" aria-hidden="true" />
        <span className="text-sm text-mt-text">
          <span className="underline underline-offset-4">Choose images</span> or drag them here
        </span>
        <span className="text-[11px] leading-snug text-mt-subtle">
          Best on a transparent or plain background. {formatsLabel}.
        </span>
        <input type="file" accept={accept} multiple onChange={onUpload} className="sr-only" />
      </label>

      <LayerChips
        label="Images on this side"
        items={layers}
        activeId={activeDesign?.id}
        onSelect={onSelectLayer}
      />

      {activeDesign ? (
        <div className="space-y-4 rounded-mt-card border border-mt-line p-3.5">
          <PanelHeading
            title="Selected image"
            hint={libraryName ? `From the library: ${libraryName}` : "Drag it on the product to move it."}
          />

          <SliderRow
            label="Size"
            value={activeDesign.scale ?? 0.35}
            display={pct(activeDesign.scale)}
            min={0.1}
            max={1.2}
            step={0.02}
            onChange={onScale}
          />
          <p className="-mt-2 text-[11px] text-mt-subtle">
            Prints at about {inches(activeDesign.currentPrintWidthInches)} × {inches(activeDesign.currentPrintHeightInches)} in
          </p>

          <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-mt-muted">
            <span>Stretch width and height separately</span>
            <input
              type="checkbox"
              checked={stretch}
              onChange={(event) => setStretch(event.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[var(--mt-btn)]"
            />
          </label>
          {stretch && (
            <div className="space-y-3">
              <SliderRow
                label="Width"
                value={scaleX}
                display={pct(scaleX)}
                min={0.1}
                max={1.6}
                step={0.02}
                onChange={onScaleX}
                onStep={(delta) => onNudge("x", delta)}
                stepSize={0.04}
              />
              <SliderRow
                label="Height"
                value={scaleY}
                display={pct(scaleY)}
                min={0.1}
                max={1.6}
                step={0.02}
                onChange={onScaleY}
                onStep={(delta) => onNudge("y", delta)}
                stepSize={0.04}
              />
            </div>
          )}

          {zones.length > 1 && (
            <Segmented label="Placement" options={zones} value={activeZone} onChange={onZoneChange} />
          )}

          <div className="grid grid-cols-3 gap-2">
            <ToolButton
              icon={removingBackground ? Loader2 : Wand2}
              onClick={onRemoveBackground}
              disabled={removingBackground || activeDesign.hasBgRemoved}
              className={removingBackground ? "[&_svg]:animate-spin" : undefined}
            >
              {removingBackground ? "Removing" : activeDesign.hasBgRemoved ? "BG removed" : "Remove BG"}
            </ToolButton>
            <ToolButton icon={Crop} onClick={onCrop}>
              Crop
            </ToolButton>
            <ToolButton icon={Trash2} tone="danger" onClick={onDelete}>
              Delete
            </ToolButton>
          </div>
        </div>
      ) : layers.length > 0 ? (
        <p className="text-xs text-mt-subtle">Tap an image above or on the product to edit it.</p>
      ) : null}
    </div>
  );
};

export default UploadPanel;
