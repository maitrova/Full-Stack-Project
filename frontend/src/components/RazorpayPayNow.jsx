import React, { useState } from "react";
import { loadRazorpay } from "../utils/loadRazorpay.js";

const API_URL = import.meta.env.VITE_API_URL; // http://localhost:5000

export default function RazorpayPayNow({ token, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const createOrderFromCart = async () => {
    const res = await fetch(`${API_URL}/payment/razorpay/create-from-cart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to create Razorpay order");
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
    if (!res.ok) throw new Error(data?.message || "Payment verification failed");
    return data; // { message, order }
  };

  const handlePay = async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Razorpay SDK failed to load. Check internet or adblock.");

      // 1) create from cart
      const created = await createOrderFromCart();
      // created = { orderId, razorpayOrderId, amount, currency, razorpayKeyId }

      const options = {
        key: created.razorpayKeyId, // ✅ key_id only (safe)
        amount: created.amount,     // ✅ in paise
        currency: created.currency,
        name: "Narifighter",
        description: "Cart Payment",
        order_id: created.razorpayOrderId,

        // Optional prefill - you can remove if not needed
        prefill: {
          // name: "",
          // email: "",
          // contact: "",
        },

        handler: async function (response) {
          try {
            // 2) verify
            const verified = await verifyPayment({
              orderId: created.orderId,
              response,
            });

            setMsg(verified?.message || "Payment successful ✅");
            setErr(null);

            // callback for parent component (ex: redirect)
            if (onSuccess) onSuccess({ orderId: created.orderId, verified });
          } catch (e) {
            setErr(e.message || "Verification failed");
          }
        },

        modal: {
          ondismiss: () => {
            setErr("Payment cancelled.");
          },
        },

        theme: { color: "#0f172a" }, // Tailwind slate-900 vibe
      };

      // 3) open checkout
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      setErr(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? "Processing..." : "Pay Now"}
      </button>

      {msg ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {msg}
        </div>
      ) : null}

      {err ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {err}
        </div>
      ) : null}
    </div>
  );
}
