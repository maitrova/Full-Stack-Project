import React, { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const getSuccessPayload = (locationState) => {
  const payload = locationState?.orderSuccess;
  if (!payload || typeof payload !== "object") return null;
  if (!payload.orderId) return null;
  if (payload.totalAmount === undefined || payload.totalAmount === null) return null;
  return payload;
};

export default function OrderSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const successPayload = getSuccessPayload(location.state);
  const hasTrackedPurchaseRef = useRef(false);

  useEffect(() => {
    if (!successPayload) {
      navigate("/", { replace: true });
    }
  }, [navigate, successPayload]);

  useEffect(() => {
    if (!successPayload || hasTrackedPurchaseRef.current) {
      return;
    }

    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      const trackedItems = Array.isArray(successPayload.items) ? successPayload.items : [];

      window.fbq("track", "Purchase", {
        value: Number(successPayload.totalAmount || 0),
        currency: "INR",
        content_ids: trackedItems.map((item) => String(item.id || "")).filter(Boolean),
        contents: trackedItems.map((item) => ({
          id: String(item.id || ""),
          quantity: Number(item.quantity || 1),
          item_price: Number(item.item_price || 0),
        })),
        content_type: "product",
        num_items: Number(successPayload.itemCount || trackedItems.length || 0),
        order_id: String(successPayload.orderId),
      });
      hasTrackedPurchaseRef.current = true;
    }
  }, [successPayload]);

  if (!successPayload) return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#eefdf5_0%,_#f8fafc_28%,_#ffffff_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-[32px] border border-emerald-200 bg-white shadow-[0_40px_120px_-48px_rgba(15,23,42,0.45)]">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_36%),linear-gradient(135deg,_#ecfdf5,_#f8fafc,_#ffffff)] px-8 py-10 sm:px-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
              <svg className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a1 1 0 010 1.42l-7.13 7.13a1 1 0 01-1.414 0l-3.164-3.164a1 1 0 111.414-1.415l2.457 2.457 6.423-6.423a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <div className="mt-6 text-xs font-semibold uppercase tracking-[0.26em] text-emerald-700">
              Thank You
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Your order has been placed successfully
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              {successPayload.paymentLabel} has been recorded and your order is now confirmed.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Order Reference</div>
              <div className="mt-2 break-all text-sm font-semibold text-slate-900">{successPayload.orderId}</div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Order Total</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">Rs. {Number(successPayload.totalAmount || 0).toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Items</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{Number(successPayload.itemCount || 0)}</div>
                </div>
              </div>
            </div>

            {Array.isArray(successPayload.items) && successPayload.items.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Order Details</div>
                <div className="mt-3 space-y-3">
                  {successPayload.items.map((item, index) => (
                    <div key={`${item.id || item.name || "item"}-${index}`} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.name || "Product"}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Qty: {Number(item.quantity || 1)}
                          {item.size ? ` • Size: ${item.size}` : ""}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        Rs. {Number(item.item_price || 0).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/orders"
                replace
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                View Orders
              </Link>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
