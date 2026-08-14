import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Bell,
  Bot,
  Loader2,
  MessageCircle,
  PackageSearch,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { addToCart } from "../redux/slices/Cartslice";
import { selectCurrentToken } from "../redux/slices/Userslice";
import { buildImageUrl } from "../utils/responsiveImage";
import { buildReadymadeProductPath } from "../utils/readymadeRoutes";

const AI_AGENT_API_URL =
  import.meta.env.VITE_AI_AGENT_API_URL || "http://127.0.0.1:8000";
const AI_AGENT_FALLBACK_API_URL = "http://127.0.0.1:8002";
const MERN_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const initialMessages = [
  {
    role: "assistant",
    text: "Hi, I can help find products, compare options, and keep track of this chat.",
    products: [],
  },
];

const tabs = [
  { id: "chat", label: "Chat", Icon: MessageCircle },
  { id: "recommendations", label: "Recommendations", Icon: Sparkles },
  { id: "orders", label: "Track Order", Icon: PackageSearch },
];

const getAiAgentUrls = () => {
  const urls = [AI_AGENT_API_URL, AI_AGENT_FALLBACK_API_URL];
  return [...new Set(urls.filter(Boolean).map((url) => url.replace(/\/$/, "")))];
};

const postToAiAgent = async (path, body, config = {}) => {
  let lastError;

  for (const baseUrl of getAiAgentUrls()) {
    try {
      return await axios.post(`${baseUrl}${path}`, body, config);
    } catch (error) {
      lastError = error;
      if (!["ERR_NETWORK"].includes(error.code) && error.response?.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError;
};

const ProductCard = ({ product, addingProductId, onAddToCart, onClick }) => {
  const productPath = buildReadymadeProductPath(product);
  const imageUrl = buildImageUrl(product.image || product.thumbnail);

  return (
    <div className="rounded-md border border-gray-200 bg-white p-2 text-left shadow-sm">
      <div className="flex gap-3">
        <a
          href={productPath || "/products"}
          onClick={onClick}
          className="h-16 w-14 shrink-0 overflow-hidden rounded-md bg-gray-100"
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name || "Product"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              No image
            </div>
          )}
        </a>
        <div className="min-w-0 flex-1">
          <a href={productPath || "/products"} onClick={onClick}>
            <h3 className="line-clamp-2 text-xs font-semibold text-gray-900">
              {product.name}
            </h3>
          </a>
          <p className="mt-1 text-xs text-gray-500">
            {product.category}
            {product.subCategory ? ` / ${product.subCategory}` : ""}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-950">Rs {product.price}</p>
              {product.discountPercent > 0 && (
                <p className="text-[11px] font-semibold text-emerald-700">
                  {product.discountPercent}% off
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onAddToCart(product)}
              disabled={!product._id || addingProductId === product._id}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-950 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              aria-label={`Add ${product.name} to cart`}
              title="Add to cart"
            >
              {addingProductId === product._id ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const OfferCard = ({ offer, onClick }) => {
  const offerImageUrl = buildImageUrl(offer.image);

  return (
    <a
      href={offer.path || "/combo-packs"}
      onClick={onClick}
      className="block rounded-md border border-gray-200 bg-white p-2 text-left shadow-sm"
    >
      <div className="flex gap-3">
        <div className="h-16 w-14 shrink-0 overflow-hidden rounded-md bg-gray-100">
          {offerImageUrl ? (
            <img
              src={offerImageUrl}
              alt={offer.name || "Combo offer"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              Offer
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-xs font-semibold text-gray-900">{offer.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">
            {offer.description || "Combo offer available"}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-950">Rs {offer.price}</p>
            {offer.discountPercent > 0 && (
              <span className="rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                {offer.discountPercent}% off
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
};

const AIShoppingChat = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const authToken = useSelector(selectCurrentToken);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [sessionId, setSessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  const [isLoading, setIsLoading] = useState(false);
  const [addingProductId, setAddingProductId] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [recommendations, setRecommendations] = useState({
    response: "",
    products: [],
    offers: [],
  });
  const [recommendationNoticeCount, setRecommendationNoticeCount] = useState(0);
  const suggestedPathsRef = useRef(new Set());
  const pageStartedAtRef = useRef(Date.now());

  const pageContext = useMemo(() => {
    const pathname = location.pathname || "/";
    const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const context = {
      path: pathname,
      page_type: "general",
    };

    if (pathname === "/") {
      context.page_type = "home";
    } else if (segments[0] === "combo-packs") {
      context.page_type = segments[1] ? "combo_detail" : "combo_listing";
      context.combo_slug = segments[1] || "";
    } else if (segments[0] === "products") {
      context.page_type = segments[3] ? "product_detail" : segments[1] ? "category" : "product_listing";
      context.category = (segments[1] || "").replace(/-/g, " ");
      context.subCategory = (segments[2] || "").replace(/-/g, " ");
      context.productName = (segments[3] || "").replace(/-/g, " ");
    } else if (["readymade", "product"].includes(segments[0])) {
      context.page_type = "product_detail";
      context.product_id = segments[1] || "";
    } else if (pathname === "/cart") {
      context.page_type = "cart";
    }

    return context;
  }, [location.pathname]);

  const requestHeaders = useMemo(() => ({
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    "x-ai-session-id": sessionId,
  }), [authToken, sessionId]);

  const trackBehaviorEvent = async (eventType, extra = {}) => {
    try {
      await axios.post(
        `${MERN_API_URL}/ai/behavior-events`,
        {
          sessionId,
          eventType,
          path: pageContext.path,
          pageType: pageContext.page_type,
          productId: pageContext.product_id,
          productName: pageContext.productName,
          category: pageContext.category,
          subCategory: pageContext.subCategory,
          ...extra,
        },
        { headers: requestHeaders }
      );
    } catch {
      // Recommendation tracking should never block shopping or chat.
    }
  };

  useEffect(() => {
    const previousStartedAt = pageStartedAtRef.current;
    pageStartedAtRef.current = Date.now();

    trackBehaviorEvent(pageContext.page_type === "product_detail" ? "PRODUCT_VIEW" : "PAGE_VIEW");

    if (!suggestedPathsRef.current.has(pageContext.path)) {
      suggestedPathsRef.current.add(pageContext.path);

      postToAiAgent(
        "/recommendations",
        {
          session_id: sessionId,
          page_context: pageContext,
        },
        { headers: requestHeaders }
      ).then(({ data }) => {
        if (data.session_id) setSessionId(data.session_id);
        if (!data.response && !data.products?.length && !data.offers?.length) return;

        setRecommendations({
          response: data.response || "",
          products: Array.isArray(data.products) ? data.products : [],
          offers: Array.isArray(data.offers) ? data.offers : [],
        });
        if (activeTab !== "recommendations") {
          setRecommendationNoticeCount((count) => count + 1);
        }
      }).catch(() => {
        suggestedPathsRef.current.delete(pageContext.path);
        // The normal chat still works even if proactive recommendations fail.
      });
    }

    return () => {
      const dwellMs = Date.now() - previousStartedAt;
      if (pageContext.page_type === "product_detail" && dwellMs >= 3000) {
        trackBehaviorEvent("PRODUCT_DWELL", { dwellMs });
      }
    };
  }, [pageContext.path]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "recommendations") {
      setRecommendationNoticeCount(0);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading) return;

    const userMessage = { role: "user", text: trimmedMessage, products: [] };
    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setMessage("");
    setError("");
    setIsLoading(true);

    try {
      // Step 2: React sends the user's message to the Python FastAPI /chat endpoint.
      const { data } = await postToAiAgent("/chat", {
        session_id: sessionId,
        message: trimmedMessage,
        page_context: pageContext,
      }, {
        headers: requestHeaders,
      });

      if (data.session_id) {
        setSessionId(data.session_id);
      }

      // Step 7: The Python API now returns { response: "...", products: [...] }.
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          text: data.response,
          products: Array.isArray(data.products) ? data.products : [],
          offers: Array.isArray(data.offers) ? data.offers : [],
        },
      ]);

      await runAssistantAction(data.action);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Could not reach the AI service. Make sure FastAPI is running."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = async () => {
    const previousSessionId = sessionId;
    const nextSessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setMessages(initialMessages);
    setSessionId(nextSessionId);
    setError("");

    try {
      await axios.delete(`${AI_AGENT_API_URL}/chat/${previousSessionId}`);
    } catch {
      // The UI can reset even if the old in-memory server session was already gone.
    }
  };

  const handleAddToCart = async (product, requestedSize = null) => {
    const selectedSize =
      requestedSize ||
      product.sizes?.find((size) => /^[A-Z]{1,3}$/.test(size)) ||
      "M";

    setAddingProductId(product._id);
    setError("");

    try {
      await dispatch(
        addToCart({
          kind: "READYMADE",
          readymadeProductId: product._id,
          size: selectedSize,
          qty: 1,
        })
      ).unwrap();
      await trackBehaviorEvent("ADD_TO_CART_AI", {
        productId: product._id,
        productName: product.name,
        category: product.category,
        subCategory: product.subCategory,
      });
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          text: `${product.name} was added to your cart.`,
          products: [],
        },
      ]);
    } catch (cartError) {
      setError(cartError?.message || "Could not add this product to cart.");
    } finally {
      setAddingProductId("");
    }
  };

  const runAssistantAction = async (action) => {
    if (action?.type !== "add_to_cart" || !action.product) return;
    await handleAddToCart(action.product, action.size);
  };

  const handleRecommendationClick = (item, metadata = {}) => {
    trackBehaviorEvent("RECOMMENDATION_CLICK", {
      productId: item._id,
      productName: item.name,
      category: item.category,
      subCategory: item.subCategory,
      metadata,
    });
  };

  const renderProducts = (products = [], limit = 3) => (
    <div className="space-y-2">
      {products.slice(0, limit).map((product, productIndex) => (
        <ProductCard
          key={product._id || `${product.name}-${productIndex}`}
          product={product}
          addingProductId={addingProductId}
          onAddToCart={handleAddToCart}
          onClick={() => handleRecommendationClick(product)}
        />
      ))}
    </div>
  );

  const renderOffers = (offers = [], limit = 3) => (
    <div className="space-y-2">
      {offers.slice(0, limit).map((offer, offerIndex) => (
        <OfferCard
          key={offer._id || `${offer.name}-${offerIndex}`}
          offer={offer}
          onClick={() => handleRecommendationClick(offer, {
            offerId: offer._id,
            source: "combo_offer",
          })}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed bottom-5 right-4 z-50 sm:right-6">
      {isOpen && (
        <section className="mb-3 flex h-[560px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-gray-200 bg-gray-950 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2">
              <Bot className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">AI Shopping Assistant</h2>
                <p className="truncate text-xs text-gray-300">Complete shopping agent</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                className="rounded-md px-2 py-1 text-xs text-gray-200 transition hover:bg-white/10 hover:text-white"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1.5 text-gray-200 transition hover:bg-white/10 hover:text-white"
                aria-label="Close AI chat"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="grid grid-cols-3 border-b border-gray-200 bg-white px-2 py-2">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={`relative flex min-w-0 items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-semibold transition ${
                  activeTab === id
                    ? "bg-gray-950 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
                {id === "recommendations" && recommendationNoticeCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                    {recommendationNoticeCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === "chat" && (
            <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
              {messages.map((chatMessage, index) => (
                <div
                  key={`${chatMessage.role}-${index}`}
                  className={`flex ${
                    chatMessage.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className={`max-w-[90%] ${chatMessage.role === "user" ? "" : "space-y-2"}`}>
                    <p
                      className={`rounded-md px-3 py-2 text-sm leading-6 ${
                        chatMessage.role === "user"
                          ? "bg-gray-950 text-white"
                          : "border border-gray-200 bg-white text-gray-800"
                      }`}
                    >
                      {chatMessage.text}
                    </p>

                    {chatMessage.role === "assistant" && chatMessage.products?.length > 0 && (
                      renderProducts(chatMessage.products, 3)
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Thinking
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "recommendations" && (
            <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50 px-4 py-4">
              <div className="rounded-md border border-orange-100 bg-orange-50 p-3">
                <div className="flex items-start gap-2">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden="true" />
                  <p className="text-sm leading-6 text-gray-800">
                    {recommendations.response || "I will show page-based offers and products here as you browse."}
                  </p>
                </div>
              </div>

              {recommendations.offers.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Combo Offers
                  </h3>
                  {renderOffers(recommendations.offers, 3)}
                </div>
              )}

              {recommendations.products.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Recommended Products
                  </h3>
                  {renderProducts(recommendations.products, 5)}
                </div>
              )}
            </div>
          )}

          {activeTab === "orders" && (
            <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4">
              <div className="rounded-md border border-gray-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <ShoppingBag className="mt-0.5 h-5 w-5 shrink-0 text-gray-700" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-950">Order help</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      Ask in chat about your order status, delivery, returns, or payment. Direct order lookup will be connected in the next backend step.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("chat");
                        setMessage("Track my latest order");
                      }}
                      className="mt-3 rounded-md bg-gray-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
                    >
                      Ask to track order
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 bg-white p-3">
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask about outfits..."
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
            <button
              type="submit"
              disabled={isLoading || !message.trim()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-950 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gray-950 text-white shadow-xl transition hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-900/20"
        aria-label={isOpen ? "Close AI chat" : "Open AI chat"}
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
        )}
      </button>
    </div>
  );
};

export default AIShoppingChat;
