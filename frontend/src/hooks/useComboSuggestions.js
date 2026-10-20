import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { selectCurrentToken } from "../redux/slices/Userslice.js";

const API_URL = import.meta.env.VITE_API_URL;

// Loads the combo nudges for the cart and reloads them whenever the cart
// contents (items, sizes, quantities, prices) change.
export const useComboSuggestions = (cartItems = []) => {
  const [suggestions, setSuggestions] = useState([]);
  const token = useSelector(selectCurrentToken);

  const cartKey = useMemo(
    () => cartItems.map((item) => `${item._id}:${item.size}:${item.qty}:${item.unitPrice}`).join("|"),
    [cartItems]
  );

  useEffect(() => {
    let cancelled = false;
    if (!cartKey) return undefined;

    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/cart/combo-suggestions`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          withCredentials: true,
        });
        if (!cancelled) setSuggestions(Array.isArray(res.data?.suggestions) ? res.data.suggestions : []);
      } catch (error) {
        console.error("Failed to load combo suggestions:", error);
        if (!cancelled) setSuggestions([]);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [cartKey, token]);

  return cartKey ? suggestions : [];
};

export default useComboSuggestions;
