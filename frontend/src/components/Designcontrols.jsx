// src/components/DesignerControls.jsx
import React from 'react';

const FONT_OPTIONS = [
  "Impact, sans-serif",
  "Arial, sans-serif",
  "Helvetica, sans-serif",
  "'Times New Roman', serif",
  "Georgia, serif",
  "'Comic Sans MS', cursive, sans-serif",
];

// Tab options
const TABS = {
  PRODUCT_COLORS: 'productColors',
  DESIGNS: 'designs',
  TEXT: 'text',
  VIEWS: 'views'
};

const DesignerControls = ({
  // Props for state
  productColor,
  activeTab,
  isEditMode,
  editDesignId,
  originalDesign,
  designLayers,
  activeDesign,
  bgRemovalLoading,
  activeTextLayer,
  viewCode,
  product,
  viewStates,
  
  // Props for errors
  error,
  saveError,
  saveSuccess,
  
  // Props for handlers
  onColorChange,
  onTabChange,
  onRemoveBackground,
  onClearActiveDesign,
  onDesignScaleChange,
  onAddNewText,
  onRemoveActiveText,
  onUpdateActiveTextLayer,
  onSetViewCode,
  onDesignUpload,
  onResetToOriginal,
  onBackToAdmin
}) => {
  const colorOptions = [
    "#FFFFFF", "#000000", "#FF6B6B", "#4ECDC4", "#45B7D1",
    "#96CEB4", "#FECA57", "#FF9FF3", "#54A0FF", "#5F27CD",
    "#00D2D3", "#FF9F43",
  ];

  const MINIMUM_DESIGN_CHARGE = 30;
  const SLEEVE_PRICE = 30;
  const FIXED_SIZE_INCHES = 4;

  return (
    <aside className="w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-6">
      {/* Edit mode indicator */}
      {isEditMode && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-xs font-medium text-amber-700">Edit Mode</span>
          </div>
          <p className="mt-1 text-[10px] text-amber-600">
            Editing design ID: {editDesignId?.slice(0, 8)}...
          </p>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => onTabChange(TABS.PRODUCT_COLORS)}
          className={`px-3 py-2 text-xs font-medium ${activeTab === TABS.PRODUCT_COLORS ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Product Colors
        </button>
        <button
          onClick={() => onTabChange(TABS.DESIGNS)}
          className={`px-3 py-2 text-xs font-medium ${activeTab === TABS.DESIGNS ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Designs
        </button>
        <button
          onClick={() => onTabChange(TABS.TEXT)}
          className={`px-3 py-2 text-xs font-medium ${activeTab === TABS.TEXT ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Text
        </button>
        <button
          onClick={() => onTabChange(TABS.VIEWS)}
          className={`px-3 py-2 text-xs font-medium ${activeTab === TABS.VIEWS ? 'text-sky-600 border-b-2 border-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Views
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {/* Product Colors Tab */}
        {activeTab === TABS.PRODUCT_COLORS && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 font-semibold text-sm">Product Colors</h3>
              <div className="mb-4">
                <label className="mb-2 block text-xs font-medium">Current Color</label>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded border border-slate-300" style={{ backgroundColor: productColor }} />
                  <input type="color" className="h-10 w-full cursor-pointer" value={productColor} onChange={(e) => onColorChange(e.target.value)} />
                </div>
              </div>

              <div className="mb-2">
                <label className="mb-2 block text-xs font-medium">Quick Select</label>
                <div className="grid grid-cols-6 gap-2">
                  {colorOptions.map((color) => (
                    <button key={color} className={`h-8 w-8 rounded-full border-2 ${color === productColor ? "border-sky-500" : "border-slate-300"}`} style={{ backgroundColor: color }} onClick={() => onColorChange(color)} type="button" />
                  ))}
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p className="font-medium">How to use:</p>
              <p>• Select a color to change the product color</p>
              <p>• Use the color picker for custom colors</p>
              <p>• Quick select colors are commonly used options</p>
            </div>
          </div>
        )}

        {/* Designs Tab */}
        {activeTab === TABS.DESIGNS && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 font-semibold text-sm">Upload Designs</h3>
              <p className="mb-2 text-xs text-slate-600">Upload one or more images. They will be saved to the server automatically.</p>

              <div className="mb-3 text-xs">
                <input type="file" accept="image/*" multiple onChange={onDesignUpload} className="w-full text-xs border border-slate-300 rounded px-3 py-2" />
              </div>

              {activeDesign && (
                <>
                  <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium text-slate-700 text-xs">Selected Design</span>
                      <span className="text-[10px] text-slate-500">ID: {activeDesign.id.slice(0, 6)}…</span>
                    </div>
                    
                    <div className="mb-3 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center">
                          <div className="text-[10px] text-slate-500">Display</div>
                          <div className="font-medium">{activeDesign.currentDisplayWidthInches?.toFixed(2)}" × {activeDesign.currentDisplayHeightInches?.toFixed(2)}"</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-slate-500">Print</div>
                          <div className="font-medium">{activeDesign.currentPrintWidthInches?.toFixed(2)}" × {activeDesign.currentPrintHeightInches?.toFixed(2)}"</div>
                        </div>
                      </div>
                      <div className="mt-2 text-center">
                        <div className="text-[10px] text-slate-500">Print Area</div>
                        <div className="font-medium">{activeDesign.currentPrintAreaInches?.toFixed(2)} sq.in</div>
                        {activeDesign.currentAdditionalArea > 0 ? (
                          <div className="text-[10px] text-green-600">
                            +{activeDesign.currentAdditionalArea?.toFixed(2)} sq.in extra
                          </div>
                        ) : activeDesign.minimumChargeApplied && (
                          <div className="text-[10px] text-amber-600">
                            Minimum ₹{MINIMUM_DESIGN_CHARGE} charge
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={onRemoveBackground} disabled={bgRemovalLoading} className={`flex-1 rounded border px-2 py-1 text-xs font-medium ${bgRemovalLoading ? "border-slate-300 text-slate-400" : "border-sky-500 text-sky-700 hover:bg-sky-50"}`}>
                        {bgRemovalLoading ? "Removing…" : "Remove BG"}
                      </button>
                      <button type="button" onClick={onClearActiveDesign} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="mb-2 block text-xs font-medium">Design Size</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={0.1} max={1.2} step={0.02} value={activeDesign.scale} onChange={(e) => onDesignScaleChange(e.target.value)} className="flex-1" />
                      <span className="w-10 text-right text-xs text-slate-600">{Math.round(activeDesign.scale * 100)}%</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                      <div>Display: {activeDesign.currentDisplayWidthInches?.toFixed(2)}" × {activeDesign.currentDisplayHeightInches?.toFixed(2)}"</div>
                      <div>Print: {activeDesign.currentPrintWidthInches?.toFixed(2)}" × {activeDesign.currentPrintHeightInches?.toFixed(2)}"</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p>• Click on a design in the editor to select it</p>
                    <p>• Drag to reposition, or use the resize handle</p>
                    <p>• Click "Remove BG" for transparent background</p>
                    <p>• Sleeves have fixed pricing of ₹{SLEEVE_PRICE} each</p>
                  </div>
                </>
              )}

              {!activeDesign && designLayers.length > 0 && (
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <p className="text-xs text-slate-600 text-center">
                    {designLayers.length} design{designLayers.length !== 1 ? 's' : ''} uploaded
                  </p>
                  <p className="text-[10px] text-slate-500 text-center mt-1">
                    Click any design on the shirt to select it and edit.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Text Tab */}
        {activeTab === TABS.TEXT && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Text Customization</h3>
              <div className="flex gap-2">
                <button className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" type="button" onClick={onAddNewText}>+ Add Text</button>
                <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40" type="button" onClick={onRemoveActiveText} disabled={!activeTextLayer}>Remove</button>
              </div>
            </div>

            {activeTextLayer ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Text Content</label>
                  <input type="text" className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500" value={activeTextLayer.text} onChange={(e) => onUpdateActiveTextLayer({ text: e.target.value })} placeholder="Enter text here" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Font</label>
                    <select className="w-full rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-sky-500" value={activeTextLayer.fontFamily} onChange={(e) => onUpdateActiveTextLayer({ fontFamily: e.target.value })}>
                      {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f.replace(/,.*$/, "")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Color</label>
                    <input type="color" className="h-8 w-full cursor-pointer rounded border border-slate-300" value={activeTextLayer.color} onChange={(e) => onUpdateActiveTextLayer({ color: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Font Size</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={14} max={120} value={activeTextLayer.fontSize} onChange={(e) => onUpdateActiveTextLayer({ fontSize: parseInt(e.target.value, 10) })} className="flex-1" />
                    <span className="w-10 text-right text-xs text-slate-600">{activeTextLayer.fontSize}px</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Rotation</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={-45} max={45} value={activeTextLayer.rotation} onChange={(e) => onUpdateActiveTextLayer({ rotation: parseInt(e.target.value, 10) })} className="flex-1" />
                    <span className="w-10 text-right text-xs text-slate-600">{activeTextLayer.rotation}°</span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p>• Drag the text on the shirt to reposition</p>
                  <p>• Use the corner handle to resize</p>
                  <p>• Click "Remove" to delete selected text</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded border border-slate-200 text-center">
                <p className="text-xs text-slate-600">No text added yet.</p>
                <p className="text-[10px] text-slate-500 mt-1">Click "+ Add Text" to start customizing.</p>
              </div>
            )}
          </div>
        )}

        {/* Views Tab */}
        {activeTab === TABS.VIEWS && product.views && product.views.length > 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 font-semibold text-sm">Product Views</h3>
              <p className="mb-3 text-xs text-slate-600">Switch between different views of the product to add designs/text on different areas.</p>

              <div className="space-y-2">
                {product.views.map((v) => {
                  const viewState = viewStates[v.code];
                  const hasLayers = viewState && (viewState.textLayers?.length > 0 || viewState.designLayers?.length > 0);
                  const isCurrent = v.code === viewCode;
                  
                  return (
                    <button
                      key={v.code}
                      type="button"
                      onClick={() => onSetViewCode(v.code)}
                      className={`w-full flex items-center justify-between rounded px-3 py-2 text-xs border ${isCurrent ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span>{v.label}</span>
                      <div className="flex items-center gap-2">
                        {hasLayers && <span className="h-2 w-2 bg-emerald-500 rounded-full"></span>}
                        {isCurrent && (
                          <svg className="w-3 h-3 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p className="font-medium">Current View: {product.views.find(v => v.code === viewCode)?.label}</p>
              <p>• Front: Main design area</p>
              <p>• Back: Back of the product</p>
              <p>• Left/Right Sleeves: Sleeve designs</p>
              <p>• Each view has separate text and design layers</p>
            </div>
          </div>
        )}
      </div>

      {/* Error messages */}
      {(error || saveError || saveSuccess) && (
        <div className="mt-4">
          {error && <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
          {saveError && <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{saveError}</div>}
          {saveSuccess && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{"Design saved successfully!"}</div>}
        </div>
      )}

      {/* Back to admin button */}
      {isEditMode && (
        <button 
          onClick={onBackToAdmin} 
          className="mt-4 rounded border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
        >
          Back to Admin
        </button>
      )}

      {/* Reset to original button */}
      {isEditMode && originalDesign && (
        <button 
          onClick={onResetToOriginal} 
          className="mt-2 rounded border border-amber-300 px-3 py-2 text-xs text-amber-600 hover:bg-amber-50"
        >
          Reset to Original
        </button>
      )}
    </aside>
  );
};

export default DesignerControls;