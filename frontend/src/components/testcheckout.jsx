import React from "react";
import { useSelector } from "react-redux";
import RazorpayPayNow from "../components/RazorpayPayNow.jsx";
import { selectCurrentToken } from "../redux/slices/Userslice.js";



export default function CheckoutPage() {
  const token = useSelector(selectCurrentToken);

  return (
    <div className="mx-auto max-w-xl p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Checkout</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pay securely using Razorpay.
        </p>

        <div className="mt-5">
          <RazorpayPayNow
            token={token}
            onSuccess={({ orderId }) => {
              // example: redirect
              // navigate(`/order-success/${orderId}`);
              console.log("Paid order:", orderId);
            }}
          />
        </div>
      </div>
    </div>
  );
}
