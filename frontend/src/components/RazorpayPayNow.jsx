import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadRazorpay } from "../utils/loadRazorpay.js";

const API_URL = import.meta.env.VITE_API_URL;

export default function RazorpayPayNow({ token }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const navigate = useNavigate();

  // 🔹 Create Order From Cart
  const createOrderFromCart = async () => {
    const res = await fetch(
      `${API_URL}/payment/razorpay/create-from-cart`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to create order");

    return data;
  };

  // 🔹 Verify Payment
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
      if (!ok)
        throw new Error("Razorpay SDK failed to load. Check internet.");

      // 1️⃣ Create Order
      const created = await createOrderFromCart();

      const options = {
        key: created.razorpayKeyId,
        amount: created.amount,
        currency: created.currency,
        name: "Narifighter",
        description: "Secure Cart Payment",
        order_id: created.razorpayOrderId,

        handler: async function (response) {
          try {
            // 2️⃣ Verify Payment (Email triggered inside backend)
            await verifyPayment({
              orderId: created.orderId,
              response,
            });

            // 3️⃣ Redirect to success page
            navigate(`/orders`);

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
        disabled={loading}
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
