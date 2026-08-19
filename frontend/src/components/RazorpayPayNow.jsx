import React, { useState } from "react";
import { loadRazorpay } from "../utils/loadRazorpay.js";

const API_URL = import.meta.env.VITE_API_URL || "https://maitrova.in/api";

export default function RazorpayPayNow({
  token,
  couponCode = "",
  disabled = false,
  onSuccess,
  onOrderCreated,
  onPaymentInfo,
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const createOrderFromCart = async () => {
    const res = await fetch(`${API_URL}/payment/razorpay/create-from-cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        couponCode ? { couponCode: String(couponCode).trim().toUpperCase() } : {}
      ),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to create order");

    return data;
  };

  const verifyPayment = async ({ orderId, response }) => {
    const res = await fetch(`${API_URL}/payment/razorpay/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        orderId,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Verification failed");

    return data;
  };

  const handlePay = async () => {
    setLoading(true);
    setErr(null);

    try {
      const ok = await loadRazorpay();
      if (!ok) {
        throw new Error("Razorpay SDK failed to load. Check internet.");
      }

      const created = await createOrderFromCart();
      onOrderCreated?.(created);

      const options = {
        key: created.razorpayKeyId,
        amount: created.amount,
        currency: created.currency,
        name: "maitrova",
        description: "Secure Cart Payment",
        order_id: created.razorpayOrderId,
        handler: async (response) => {
          try {
            await verifyPayment({
              orderId: created.orderId,
              response,
            });

            onSuccess?.({
              orderId: created.orderId,
              razorpayOrderId: created.razorpayOrderId,
            });
          } catch (error) {
            setErr(error.message || "Verification failed");
          }
        },
        modal: {
          ondismiss: () => {
            setErr("Payment cancelled.");
          },
        },
        theme: { color: "#0f172a" },
      };

      const rzp = new window.Razorpay(options);
      onPaymentInfo?.(created);
      rzp.open();
    } catch (error) {
      setErr(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={handlePay}
        disabled={loading || disabled}
        className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? "Processing..." : "Pay Now"}
      </button>

      {err && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {err}
        </div>
      )}
    </div>
  );
}
