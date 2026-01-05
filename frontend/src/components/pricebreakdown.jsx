// src/components/PriceBreakdown.jsx
import React from 'react';

// Pricing constants
const FIXED_SIZE_INCHES = 4;
const PRICE_PER_SQ_INCH = 6;
const SLEEVE_PRICE = 30;
const MINIMUM_DESIGN_CHARGE = 30;

const PriceBreakdown = ({ 
  price, 
  priceBreakdown, 
  BASE_PRICE, 
  calculatingPrice,
  onRecalculate 
}) => {
  return (
    <aside className="w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-green-800">Price Breakdown</h3>
          <button 
            onClick={onRecalculate} 
            disabled={calculatingPrice} 
            className="text-xs text-green-600 hover:text-green-800"
          >
            {calculatingPrice ? "Calculating..." : "↻"}
          </button>
        </div>
        <div className="text-xs text-slate-500 mt-1">Real-time price calculation</div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="space-y-4">
          {/* Base Price */}
          <div className="pb-3 border-b border-slate-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium text-slate-700">Base Product</span>
              <span className="text-sm font-semibold">₹{BASE_PRICE.toFixed(2)}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Base product price
            </div>
          </div>
          
          {/* Sleeves */}
          {priceBreakdown.sleeves.total > 0 && (
            <div className="pb-3 border-b border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-slate-700">Sleeves</span>
                <span className="text-sm font-semibold text-green-600">+₹{priceBreakdown.sleeves.total.toFixed(2)}</span>
              </div>
              <div className="text-[10px] text-slate-500">
                {priceBreakdown.sleeves.count} sleeve{priceBreakdown.sleeves.count !== 1 ? 's' : ''} × ₹{SLEEVE_PRICE} each
              </div>
            </div>
          )}
          
          {/* Images/Designs */}
          {priceBreakdown.images.total > 0 && (
            <div className="pb-3 border-b border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-slate-700">Designs</span>
                <span className="text-sm font-semibold text-green-600">+₹{priceBreakdown.images.total.toFixed(2)}</span>
              </div>
              <div className="space-y-2">
                {priceBreakdown.images.items.map((item, index) => (
                  <div key={index} className="text-[10px] bg-slate-50 p-2 rounded">
                    <div className="flex justify-between">
                      <span className="font-medium">Design {index + 1}</span>
                      <span>₹{item.price.toFixed(2)}</span>
                    </div>
                    {item.type === 'sleeve' ? (
                      <div className="text-slate-500 mt-1">Sleeve ({item.zone}) - Fixed price</div>
                    ) : (
                      <>
                        <div className="text-slate-500 mt-1">Size: {item.displaySize}</div>
                        <div className="text-slate-500">Print: {item.printSize}</div>
                        <div className="text-amber-600 text-[9px] mt-1">{item.note}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Text */}
          {priceBreakdown.text.total > 0 && (
            <div className="pb-3 border-b border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-slate-700">Text</span>
                <span className="text-sm font-semibold text-green-600">+₹{priceBreakdown.text.total.toFixed(2)}</span>
              </div>
              <div className="space-y-2">
                {priceBreakdown.text.items.map((item, index) => (
                  <div key={index} className="text-[10px] bg-slate-50 p-2 rounded">
                    <div className="flex justify-between">
                      <span className="font-medium">"{item.text}"</span>
                      <span>₹{item.price.toFixed(2)}</span>
                    </div>
                    <div className="text-slate-500 mt-1">Size: {item.displaySize} (Display)</div>
                    <div className="text-slate-500">Print: {item.printSize}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Minimum Charges */}
          {priceBreakdown.minimumCharges > 0 && (
            <div className="pb-3 border-b border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-amber-700">Minimum Charges</span>
                <span className="text-sm font-semibold text-amber-700">+₹{priceBreakdown.minimumCharges.toFixed(2)}</span>
              </div>
              <div className="text-[10px] text-amber-600">
                Applied to designs/text smaller than {FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}"
              </div>
            </div>
          )}
          
          {/* Additional Area */}
          {priceBreakdown.additionalArea > 0 && (
            <div className="pb-3 border-b border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-green-700">Additional Area</span>
                <span className="text-sm font-semibold text-green-700">+₹{(priceBreakdown.additionalArea * PRICE_PER_SQ_INCH).toFixed(2)}</span>
              </div>
              <div className="text-[10px] text-green-600">
                {priceBreakdown.additionalArea.toFixed(2)} sq.in × ₹{PRICE_PER_SQ_INCH}/sq.in
              </div>
            </div>
          )}
          
          {/* Total */}
          <div className="pt-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-slate-800">Total Price</span>
              <span className="text-xl font-bold text-green-600">₹{price.toFixed(2)}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Including all designs, text, and additional charges
            </div>
          </div>
        </div>
      </div>
      
      {/* Pricing Info */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="text-xs text-slate-600 space-y-1">
          <p className="font-medium mb-1">Pricing Information:</p>
          <p>• Base includes {FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}" design area</p>
          <p>• Minimum charge: ₹{MINIMUM_DESIGN_CHARGE} (≤{FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}")</p>
          <p>• Additional: ₹{PRICE_PER_SQ_INCH} per sq.inch beyond {FIXED_SIZE_INCHES}"×{FIXED_SIZE_INCHES}"</p>
          <p>• Sleeves: Fixed ₹{SLEEVE_PRICE} each</p>
          <p>• Display: 72 DPI (screen preview)</p>
          <p>• Print: 300 DPI (production)</p>
        </div>
      </div>
    </aside>
  );
};

export default PriceBreakdown;