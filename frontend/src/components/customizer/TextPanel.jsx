import { Plus, RotateCcw, Trash2 } from "lucide-react";
import cx from "../ui/cx.js";
import { LayerChips, PanelHeading, Segmented, SliderRow, ToolButton } from "./controls.jsx";

const TEXT_COLORS = [
  { value: "#ffffff", label: "White" },
  { value: "#111111", label: "Black" },
  { value: "#8b4f2c", label: "Brown" },
  { value: "#c8a24a", label: "Gold" },
  { value: "#b3261e", label: "Red" },
  { value: "#1f3a6e", label: "Navy" },
  { value: "#1f3a2e", label: "Forest green" },
];

const fontLabel = (font) => String(font).replace(/,.*$/, "").replace(/'/g, "");

/**
 * "Text" tool: add text and edit the selected text layer.
 */
const TextPanel = ({
  layers = [],
  activeLayer,
  onSelectLayer,
  onAdd,
  onRemove,
  onChange,
  fonts = [],
  zones = [],
  activeZone,
  onZoneChange,
}) => {
  const color = String(activeLayer?.color || "#000000").toLowerCase();
  const isPreset = TEXT_COLORS.some((preset) => preset.value === color);

  return (
    <div className="space-y-5">
      <PanelHeading
        title="Text"
        hint="Add a name, number or short message."
        action={
          <ToolButton icon={Plus} onClick={onAdd}>
            Add text
          </ToolButton>
        }
      />

      <LayerChips label="Text on this side" items={layers} activeId={activeLayer?.id} onSelect={onSelectLayer} />

      {activeLayer ? (
        <div className="space-y-4 rounded-mt-card border border-mt-line p-3.5">
          <div>
            <label htmlFor="customizer-text" className="mb-1.5 block text-xs text-mt-muted">
              Your text
            </label>
            <input
              id="customizer-text"
              type="text"
              value={activeLayer.text}
              onChange={(event) => onChange({ text: event.target.value })}
              placeholder="Type here"
              className="h-10 w-full rounded-mt-btn border border-mt-line-strong bg-mt-surface px-3 text-sm text-mt-text outline-none focus:border-mt-text"
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs text-mt-muted">Font</p>
            <div className="grid grid-cols-2 gap-1.5">
              {fonts.map((font) => {
                const active = activeLayer.fontFamily === font;
                return (
                  <button
                    key={font}
                    type="button"
                    onClick={() => onChange({ fontFamily: font })}
                    aria-pressed={active}
                    style={{ fontFamily: font }}
                    className={cx(
                      "h-9 truncate rounded-mt-btn border px-2 text-sm transition-colors",
                      active ? "border-mt-text bg-mt-tint/10 text-mt-text" : "border-mt-line text-mt-muted hover:border-mt-line-strong"
                    )}
                  >
                    {fontLabel(font)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-mt-muted">Colour</p>
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Text colour">
              {TEXT_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  role="radio"
                  aria-checked={color === preset.value}
                  aria-label={preset.label}
                  title={preset.label}
                  onClick={() => onChange({ color: preset.value })}
                  className={cx(
                    "h-7 w-7 rounded-full border border-mt-tint/25",
                    color === preset.value && "ring-2 ring-mt-text ring-offset-2 ring-offset-mt-surface"
                  )}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
              <label
                title="Custom colour"
                className={cx(
                  "relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-mt-tint/25 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]",
                  !isPreset && "ring-2 ring-mt-text ring-offset-2 ring-offset-mt-surface"
                )}
              >
                <span className="sr-only">Custom colour</span>
                <input
                  type="color"
                  value={color}
                  onChange={(event) => onChange({ color: event.target.value })}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <SliderRow
                label="Rotation"
                value={activeLayer.rotation ?? 0}
                display={`${activeLayer.rotation ?? 0}°`}
                min={-45}
                max={45}
                step={1}
                onChange={(value) => onChange({ rotation: parseInt(value, 10) })}
              />
            </div>
            <button
              type="button"
              onClick={() => onChange({ rotation: 0 })}
              disabled={!activeLayer.rotation}
              aria-label="Straighten text"
              title="Straighten"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-mt-btn border border-mt-line-strong text-mt-text hover:bg-mt-tint/10 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {zones.length > 1 && <Segmented label="Placement" options={zones} value={activeZone} onChange={onZoneChange} />}

          <p className="text-[11px] text-mt-subtle">Drag the text on the product to move it; use its corner handle to resize.</p>

          <ToolButton icon={Trash2} tone="danger" onClick={onRemove} className="w-full">
            Delete this text
          </ToolButton>
        </div>
      ) : (
        <p className="rounded-mt-card border border-dashed border-mt-line p-5 text-center text-xs text-mt-subtle">
          No text yet. Tap “Add text” to start.
        </p>
      )}
    </div>
  );
};

export default TextPanel;
