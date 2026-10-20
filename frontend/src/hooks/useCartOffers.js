import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { selectCurrentToken } from "../redux/slices/Userslice.js";

const API_URL = import.meta.env.VITE_API_URL;

const emptyOffers = {
  subtotal: 0,
  discount: 0,
  applied: null,
  nextUnlock: null,
  offers: [],
  recommendations: [],
};

// Loads the cart value offers from the server and reloads them whenever the
// cart contents (items, quantities, prices) or the coupon state change.
export const useCartOffers = (cartItems = [], { couponApplied = false } = {}) => {
  const [data, setData] = useState(emptyOffers);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const token = useSelector(selectCurrentToken);

  const cartKey = useMemo(
    () => cartItems.map((item) => `${item._id}:${item.qty}:${item.unitPrice}`).join("|"),
    [cartItems]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/cart/offers`, {
          params: couponApplied ? { couponApplied: true } : {},
          // The server reads the login from this header, not from cookies.
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          withCredentials: true,
        });
        if (!cancelled) setData({ ...emptyOffers, ...res.data });
      } catch (error) {
        console.error("Failed to load cart offers:", error);
        if (!cancelled) setData(emptyOffers);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [cartKey, couponApplied, reloadKey, token]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  return { ...data, loading, refresh };
};

export default useCartOffers;
