import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { selectCurrentToken } from "../redux/slices/Userslice";

const safeDestination = (value) => (["/orders", "/cart", "/checkout"].includes(value) ? value : "/checkout");

export default function WhatsAppConnect() {
  const authToken = useSelector(selectCurrentToken);
  const [searchParams] = useSearchParams();
  const linkToken = searchParams.get("token") || "";
  const location = useLocation();
  const navigate = useNavigate();
  const attemptedToken = useRef("");
  const [status, setStatus] = useState(linkToken ? "waiting" : "idle");
  const [message, setMessage] = useState("");
  const [destination, setDestination] = useState("/checkout");
  const [busy, setBusy] = useState(false);
  const api = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  useEffect(() => {
    if (!linkToken || authToken || attemptedToken.current) return;
    navigate("/login", { replace: true, state: { from: location } });
  }, [authToken, linkToken, location, navigate]);

  useEffect(() => {
    if (!linkToken || !authToken || attemptedToken.current === linkToken) return;
    attemptedToken.current = linkToken;
    setStatus("linking");
    setMessage("");

    axios
      .post(
        `${api}/whatsapp-commerce/link/complete`,
        { token: linkToken },
        { headers: { Authorization: `Bearer ${authToken}` } }
      )
      .then(({ data }) => {
        const nextDestination = safeDestination(data?.redirectTo);
        setDestination(nextDestination);
        setStatus("success");
        setMessage(
          nextDestination === "/checkout"
            ? "Connected. Your confirmed item is ready for address and payment."
            : "Connected. Your orders are ready to view."
        );
      })
      .catch((error) => {
        attemptedToken.current = "";
        setStatus("error");
        setMessage(error.response?.data?.message || "This secure link could not be completed. Please request a new link in WhatsApp.");
      });
  }, [api, authToken, linkToken]);

  useEffect(() => {
    if (status !== "success") return undefined;
    const timer = window.setTimeout(() => navigate(destination, { replace: true }), 1200);
    return () => window.clearTimeout(timer);
  }, [destination, navigate, status]);

  async function revoke() {
    if (!authToken) return;
    setBusy(true);
    setMessage("");
    try {
      await axios.delete(`${api}/whatsapp-commerce/link`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setMessage("WhatsApp account access has been revoked.");
    } catch {
      setMessage("Unable to revoke WhatsApp access. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (linkToken) {
    return (
      <main className="mx-auto max-w-xl space-y-5 p-8 text-center">
        <h1 className="text-2xl font-semibold">Continue your WhatsApp shopping</h1>
        {(status === "waiting" || status === "linking") && <p>Securely connecting your account and preparing your cart…</p>}
        {status === "success" && (
          <>
            <p className="text-green-700" role="status">{message}</p>
            <Link className="inline-block rounded bg-black px-5 py-3 text-white" to={destination}>
              Continue
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-red-700" role="alert">{message}</p>
            <p>Return to WhatsApp and confirm the product again to receive a fresh link.</p>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl space-y-5 p-8">
      <h1 className="text-2xl font-semibold">WhatsApp shopping</h1>
      <p>No connection code is needed. Select and confirm a product in our WhatsApp chat, then tap the secure checkout link sent by the assistant.</p>
      {!authToken ? (
        <p><Link className="underline" to="/login">Sign in</Link> to manage your WhatsApp connection.</p>
      ) : (
        <button disabled={busy} className="underline disabled:opacity-50" onClick={revoke}>
          {busy ? "Revoking…" : "Revoke WhatsApp access"}
        </button>
      )}
      <p role="status">{message}</p>
    </main>
  );
}
