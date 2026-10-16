import { Fragment, createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  AlertCircle,
  ArrowUp,
  Check,
  ChevronRight,
  Headset,
  Loader2,
  MessageCircle,
  PackageSearch,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import {
  addToCart,
  getCart,
  removeCartItem,
  selectCart,
  selectCartSummary,
  updateCartItemQty,
} from "../redux/slices/Cartslice";
import { selectCurrentToken } from "../redux/slices/Userslice";
import { buildImageUrl } from "../utils/responsiveImage";
import { buildReadymadeProductPath } from "../utils/readymadeRoutes";

// Base URL of the FastAPI AI router, e.g. https://ai.maitrova.in/api/ai
const AI_AGENT_API_URL = (
  import.meta.env.VITE_AI_AGENT_API_URL || "http://localhost:8000/api/ai"
).replace(/\/$/, "");
const MERN_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
// The browser session id identifies this shopper's chat to both backends and
// never changes until Reset or sign-out. The conversation id is the FastAPI
// conversation that the session is currently attached to.
const CHAT_SESSION_STORAGE_KEY = "ai-shopping-chat-session-id";
const CHAT_CONVERSATION_STORAGE_KEY = "ai-shopping-chat-conversation-id";
const BRAND_LOGO = "/logo/logo.jpeg";

const initialMessages = [
  {
    role: "assistant",
    text: "Hi, I'm the Maitrova shopping assistant. Ask me about products, sizes, custom designs, offers or your orders.",
    products: [],
  },
];

const tabs = [
  { id: "chat", label: "Chat", Icon: MessageCircle },
  { id: "recommendations", label: "For you", Icon: Sparkles },
  { id: "orders", label: "Orders", Icon: PackageSearch },
];

const PRODUCT_CHIPS = [
  { label: "Product details", action: "product_details" },
  { label: "Fabric & quality", action: "product_fabric" },
  { label: "Size & fit guide", action: "product_size_fit" },
  { label: "Available colors", action: "product_colors" },
  { label: "Offers & discounts", action: "product_offers" },
  { label: "Delivery & returns", action: "product_delivery_returns" },
  { label: "Ask something else", action: "ask_else" },
];

const buildPageQuestionSuggestions = (pageContext) => {
  if (pageContext.page_type === "product_detail") {
    return PRODUCT_CHIPS;
  }

  if (pageContext.page_type === "combo_detail" || pageContext.page_type === "combo_listing") {
    return [
      "What is included in this combo?",
      "Is this combo a better deal?",
      "Show me matching products",
      "Which combo should I buy?",
    ];
  }

  if (pageContext.page_type === "cart") {
    return [
      "Recommend add-ons for my cart",
      "Can I get a better combo?",
      "What should I remove or keep?",
      "Show offers for my cart",
    ];
  }

  return [
    "Browse products",
    "Custom products",
    "Today's offers",
    "Shipping & returns",
    "Track my order",
  ];
};

const postToAiAgent = (path, body, config = {}) =>
  axios.post(`${AI_AGENT_API_URL}${path}`, body, config);

const describeChatError = (error) => {
  const status = error.response?.status;
  const detail = error.response?.data?.detail;
  if (!error.response) {
    return "Couldn't reach the shopping assistant. Check your connection and try again.";
  }
  if (status === 429 && typeof detail === "string") return detail;
  if (status === 503) return "The shopping assistant is unavailable right now. Please try again in a few minutes.";
  if (status === 400 || status === 422) return "That message couldn't be sent. Please rephrase it and try again.";
  return "Something went wrong on our side. Please try again.";
};

const createSessionId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const readStorage = (key) => {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const writeStorage = (key, value) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Private browsing can block storage; the chat still works for this tab.
  }
};

const getStoredSessionId = () => {
  const existingSessionId = readStorage(CHAT_SESSION_STORAGE_KEY);
  // Older builds stored the Mongo conversation id here. Treat that as a
  // conversation id and start a proper browser session instead.
  if (existingSessionId && !/^[a-f0-9]{24}$/i.test(existingSessionId)) return existingSessionId;

  const nextSessionId = createSessionId();
  writeStorage(CHAT_SESSION_STORAGE_KEY, nextSessionId);
  return nextSessionId;
};

const toSitePath = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

const formatPrice = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

// The AI service returns catalogue products as { id, images, sale_price,
// attributes: {...} }; the cards below use the storefront's field names.
const normalizeAgentProduct = (product = {}) => {
  const attributes = product.attributes || {};
  const sourceType = attributes.source_type || "readymade";
  // A customizable product's blank garment is priced per size in the designer;
  // show the lowest size price ("From"), as the assistant's reply does.
  const sizePrices = sourceType === "customization"
    ? (attributes.variants || []).map((variant) => Number(variant.effective_price)).filter((value) => value > 0)
    : [];
  const price = sizePrices.length ? Math.min(...sizePrices) : Number(product.sale_price ?? product.price ?? 0);
  const originalPrice = sizePrices.length ? price : Number(product.price ?? price);
  const discountPercent = product.discountPercent ?? (
    originalPrice > price && originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0
  );

  return {
    ...product,
    _id: product._id || product.id,
    image: product.image || product.thumbnail || product.images?.[0],
    subCategory: product.subCategory || attributes.sub_category || "",
    sizes: product.sizes || attributes.sizes || [],
    price,
    originalPrice,
    discountPercent,
    sourceType,
    priceIsFrom: sizePrices.length > 0,
    // Only readymade products use the readymade cart; drop and custom
    // products are bought from their own pages.
    canAddToCart: sourceType === "readymade",
    path: toSitePath(attributes.product_url) || buildReadymadeProductPath(product),
  };
};

// Replies can contain store links; make them clickable (same-site links stay in the tab).
const URL_PATTERN = /(https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"])/g;

const MessageText = ({ text }) => (
  <>
    {String(text || "").split(URL_PATTERN).map((part, index) => {
      if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>;
      const internal = part.startsWith(window.location.origin);
      return (
        <a
          key={index}
          href={internal ? toSitePath(part) : part}
          {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          className="break-all font-medium underline decoration-gray-300 underline-offset-2 hover:decoration-current"
        >
          {internal ? toSitePath(part) : part}
        </a>
      );
    })}
  </>
);

const AssistantAvatar = ({ size = "h-7 w-7" }) => (
  <span className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white`}>
    <img src={BRAND_LOGO} alt="" className="h-full w-full object-contain p-0.5" />
  </span>
);

const TypingIndicator = () => (
  <div className="flex items-end gap-2" role="status" aria-label="Assistant is typing">
    <AssistantAvatar />
    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-3">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  </div>
);

const ORDER_STATUS_STYLES = {
  Delivered: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Shipped: "bg-sky-50 text-sky-700 ring-sky-600/20",
  "Packed and ready to ship": "bg-sky-50 text-sky-700 ring-sky-600/20",
  "Being prepared": "bg-amber-50 text-amber-700 ring-amber-600/20",
  Cancelled: "bg-gray-50 text-gray-600 ring-gray-500/20",
  "Payment failed": "bg-red-50 text-red-700 ring-red-600/20",
  "Awaiting payment": "bg-amber-50 text-amber-700 ring-amber-600/20",
};

const OrderCard = ({ order }) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const latestStep = Array.isArray(order.timeline) ? order.timeline[order.timeline.length - 1] : null;
  const followUp = order.return_request
    ? `Return: ${order.return_request.status}`
    : order.refund
      ? order.refund.status
      : null;

  return (
    <a
      href={toSitePath(order.order_page) || "/orders"}
      className="group block rounded-xl border border-gray-200 bg-white p-3 transition hover:border-gray-300 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-gray-900">Order #{order.order_number}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${ORDER_STATUS_STYLES[order.current_status] || "bg-gray-50 text-gray-700 ring-gray-500/20"}`}>
          {order.current_status}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-gray-600">
        {items.map((item) => `${item.name}${item.size ? ` (${item.size})` : ""}${item.qty > 1 ? ` × ${item.qty}` : ""}`).join(", ")}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
        <span>{order.placed_on ? `Placed ${order.placed_on}` : ""}{latestStep?.at && latestStep.status !== "Being prepared" ? ` · ${latestStep.status} ${latestStep.at.split(",")[0]}` : ""}</span>
        <span className="flex items-center gap-1 font-semibold text-gray-900">
          {formatPrice(order.total)}
          <ChevronRight className="h-3.5 w-3.5 text-gray-400 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
      {followUp && <p className="mt-1 text-[11px] font-medium text-gray-700">{followUp}</p>}
    </a>
  );
};

// Short, readable cart summary the assistant can answer from and refer to.
const buildCartSnapshot = (cart, summary) => {
  if (!cart || !Array.isArray(cart.items)) return null;
  return {
    items: cart.items.slice(0, 30).map((item) => ({
      item_id: item._id,
      name:
        item.readymadeProduct?.title ||
        item.dropproduct?.name ||
        item.design?.title ||
        item.comboName ||
        item.product?.name ||
        "Item",
      kind: item.kind,
      size: item.size,
      qty: item.qty,
      unit_price: item.unitPrice,
    })),
    subtotal: summary?.subtotal ?? null,
    total_items: summary?.totalItems ?? cart.items.length,
  };
};

// Designer mockups (/mockups/...) are stored upside down: the WebGL designer
// loads them with UNPACK_FLIP_Y. Flip them back for a plain <img>.
const isDesignerMockup = (url) => /\/mockups\//.test(String(url || ""));

const ProductCard = ({ product, addingProductId, onAddToCart, onClick }) => {
  const productPath = product.path || buildReadymadeProductPath(product);
  const imageUrl = buildImageUrl(product.image || product.thumbnail);
  const flipImage = isDesignerMockup(product.image || product.thumbnail);
  const canAddToCart = product.canAddToCart !== false;
  const adding = addingProductId === product._id;

  return (
    <div className="flex gap-3 rounded-xl border border-gray-200 bg-white p-2 transition hover:border-gray-300 hover:shadow-sm">
      <a
        href={productPath || "/products"}
        onClick={onClick}
        className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name || "Product"}
            className="h-full w-full object-cover"
            style={flipImage ? { transform: "scaleY(-1)" } : undefined}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-gray-300" aria-hidden="true" />
          </div>
        )}
      </a>
      <div className="flex min-w-0 flex-1 flex-col">
        <a href={productPath || "/products"} onClick={onClick}>
          <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-gray-900 hover:underline">
            {product.name}
          </h3>
        </a>
        {(product.category || product.subCategory) && (
          <p className="mt-0.5 truncate text-[11px] capitalize text-gray-500">
            {product.subCategory || product.category}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span className="text-sm font-semibold text-gray-950">
              {product.priceIsFrom && <span className="mr-1 text-[11px] font-normal text-gray-500">From</span>}
              {formatPrice(product.price)}
            </span>
            {product.discountPercent > 0 && (
              <>
                {product.originalPrice > product.price && (
                  <span className="text-[11px] text-gray-400 line-through">{formatPrice(product.originalPrice)}</span>
                )}
                <span className="text-[11px] font-semibold text-emerald-700">{product.discountPercent}% off</span>
              </>
            )}
          </div>
          {canAddToCart ? (
            <button
              type="button"
              onClick={() => onAddToCart(product)}
              disabled={!product._id || adding}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-gray-950 px-3 text-[11px] font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
              aria-label={`Add ${product.name} to cart`}
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : "Add"}
            </button>
          ) : (
            <a
              href={productPath || "/products"}
              onClick={onClick}
              className="inline-flex h-7 shrink-0 items-center rounded-full border border-gray-300 px-3 text-[11px] font-semibold text-gray-800 transition hover:border-gray-900"
            >
              {product.sourceType === "customization" ? "Design" : "View"}
            </a>
          )}
        </div>
        {Array.isArray(product.recommendationReasons) && product.recommendationReasons.length > 0 && (
          <div className="mt-2 space-y-0.5 border-t border-gray-100 pt-1.5">
            {product.recommendationReasons.slice(0, 2).map((reason, reasonIndex) => (
              <p key={`${product._id || product.name}-reason-${reasonIndex}`} className="text-[11px] leading-4 text-gray-600">
                {reason}
              </p>
            ))}
          </div>
        )}
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
      className="flex gap-3 rounded-xl border border-gray-200 bg-white p-2 transition hover:border-gray-300 hover:shadow-sm"
    >
      <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {offerImageUrl ? (
          <img
            src={offerImageUrl}
            alt={offer.name || "Combo offer"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Sparkles className="h-5 w-5 text-gray-300" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="w-fit rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Combo
        </span>
        <h3 className="mt-1 line-clamp-1 text-[13px] font-medium text-gray-900">{offer.name}</h3>
        <p className="line-clamp-1 text-[11px] text-gray-500">
          {offer.description || "Combo offer available"}
        </p>
        <div className="mt-auto flex items-baseline gap-1.5 pt-1">
          <span className="text-sm font-semibold text-gray-950">{formatPrice(offer.price)}</span>
          {offer.discountPercent > 0 && (
            <span className="text-[11px] font-semibold text-emerald-700">{offer.discountPercent}% off</span>
          )}
        </div>
      </div>
    </a>
  );
};

const AIShoppingChat = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const authToken = useSelector(selectCurrentToken);
  const cart = useSelector(selectCart);
  const cartSummary = useSelector(selectCartSummary);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [sessionId, setSessionId] = useState(getStoredSessionId);
  const [conversationId, setConversationId] = useState(() => {
    const stored = readStorage(CHAT_CONVERSATION_STORAGE_KEY);
    if (stored) return stored;
    // Migrate the conversation id an older build kept under the session key.
    const legacy = readStorage(CHAT_SESSION_STORAGE_KEY);
    return /^[a-f0-9]{24}$/i.test(legacy) ? legacy : "";
  });
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
  const [, setPageProductMeta] = useState(null);
  const suggestedPathsRef = useRef(new Set());
  const chatPromptPathsRef = useRef(new Set());
  const activeTabRef = useRef(activeTab);
  const previousAuthTokenRef = useRef(authToken);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
    } else if (segments[0] === "products" && segments[2] === "customize" && !segments[3]) {
      // /products/:slug/customize is a customizable product's designer page.
      context.page_type = "product_detail";
      context.product_slug = segments[1];
      context.productName = segments[1].replace(/-/g, " ");
    } else if (segments[0] === "dropproducts" && segments[1]) {
      context.page_type = "product_detail";
      context.product_id = segments[1];
    } else if (segments[0] === "products") {
      context.page_type = segments[3] ? "product_detail" : segments[1] ? "category" : "product_listing";
      context.category = (segments[1] || "").replace(/-/g, " ");
      context.subCategory = (segments[2] || "").replace(/-/g, " ");
      context.productName = (segments[3] || "").replace(/-/g, " ");
      context.product_slug = segments[3] || "";
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

  useEffect(() => {
    writeStorage(CHAT_SESSION_STORAGE_KEY, sessionId);
  }, [sessionId]);

  useEffect(() => {
    writeStorage(CHAT_CONVERSATION_STORAGE_KEY, conversationId);
  }, [conversationId]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const startNewChat = useCallback(() => {
    setMessages(initialMessages);
    setSessionId(createSessionId());
    setConversationId("");
    setError("");
    setPageProductMeta(null);
    chatPromptPathsRef.current = new Set();
  }, []);

  // Signing out must not leave the account's chat visible in this browser.
  useEffect(() => {
    const previousToken = previousAuthTokenRef.current;
    previousAuthTokenRef.current = authToken;
    if (previousToken && !authToken) startNewChat();
  }, [authToken, startNewChat]);

  useEffect(() => {
    if (isOpen) dispatch(getCart());
  }, [isOpen, dispatch]);

  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages, isLoading, isOpen, activeTab]);

  // Close with Escape, like other dialogs on the site.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // Restore saved history once per browser session (on load, Reset, or
  // sign-out), not on every page change, so live product cards are kept.
  useEffect(() => {
    let isMounted = true;

    axios.get(`${MERN_API_URL}/ai/chat-history/${sessionId}`, { headers: requestHeaders })
      .then(({ data }) => {
        const savedMessages = data?.data?.messages || [];
        if (!isMounted || !Array.isArray(savedMessages) || savedMessages.length === 0) return;

        setMessages((currentMessages) => [
          initialMessages[0],
          ...savedMessages.map((savedMessage) => ({
            role: savedMessage.role,
            text: savedMessage.content,
            products: [],
            offers: [],
          })),
          // Keep anything added while history was loading (e.g. the page prompt).
          ...currentMessages.slice(1),
        ]);
      })
      .catch(() => {
        // Saved history is optional; the chat still works without it.
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
    // Time spent on this page, reported when the shopper leaves it.
    const pageStartedAt = Date.now();

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
        if (!data.response && !data.products?.length && !data.offers?.length) return;

        setRecommendations({
          response: data.response || "",
          products: Array.isArray(data.products) ? data.products.map(normalizeAgentProduct) : [],
          offers: Array.isArray(data.offers) ? data.offers : [],
        });
        if (activeTabRef.current !== "recommendations") {
          setRecommendationNoticeCount((count) => count + 1);
        }
      }).catch(() => {
        suggestedPathsRef.current.delete(pageContext.path);
        // The normal chat still works even if proactive recommendations fail.
      });
    }

    return () => {
      const dwellMs = Date.now() - pageStartedAt;
      if (pageContext.page_type === "product_detail" && dwellMs >= 3000) {
        trackBehaviorEvent("PRODUCT_DWELL", { dwellMs });
      }
    };
  }, [pageContext.path]);

  useEffect(() => {
    const suggestions = buildPageQuestionSuggestions(pageContext);
    if (!suggestions.length || chatPromptPathsRef.current.has(pageContext.path)) return;

    chatPromptPathsRef.current.add(pageContext.path);
    const pagePrompt = {
      role: "assistant",
      text:
        pageContext.page_type === "product_detail"
          ? "I can answer questions about this product."
          : "I can help you decide from here.",
      products: [],
      offers: [],
      suggestions,
      isPagePrompt: true,
    };
    // Keep one page prompt at the end: replace the previous page's prompt
    // if the shopper navigated without chatting in between.
    setMessages((currentMessages) => {
      const lastMessage = currentMessages[currentMessages.length - 1];
      return lastMessage?.isPagePrompt
        ? [...currentMessages.slice(0, -1), pagePrompt]
        : [...currentMessages, pagePrompt];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageContext.path, sessionId]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "recommendations") {
      setRecommendationNoticeCount(0);
    }
  };

  const sendChatMessage = async (rawMessage, quickAction = null) => {
    const trimmedMessage = rawMessage.trim();
    if (!trimmedMessage || isLoading) return;

    const userMessage = { role: "user", text: trimmedMessage, products: [] };
    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setMessage("");
    setError("");
    setIsLoading(true);

    try {
      // The backend resumes the conversation only for this browser session
      // or signed-in account; otherwise it starts a new one and returns its id.
      const { data } = await postToAiAgent("/chat", {
        conversation_id: conversationId || null,
        message: trimmedMessage,
        ...(quickAction ? { quick_action: quickAction } : {}),
        page_context: pageContext,
        cart: buildCartSnapshot(cart, cartSummary),
      }, {
        headers: requestHeaders,
      });

      const nextConversationId = data.conversation?.id || data.conversation?._id;
      if (nextConversationId) setConversationId(nextConversationId);

      const assistantText = data.ai_message?.content || data.response || "";
      const products = (Array.isArray(data.recommended_products)
        ? data.recommended_products
        : Array.isArray(data.products) ? data.products : []
      ).map(normalizeAgentProduct);
      if (data.ai_message?.metadata?.page_product) setPageProductMeta(data.ai_message.metadata.page_product);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          text: assistantText,
          products,
          offers: Array.isArray(data.offers) ? data.offers : [],
          designs: Array.isArray(data.design_previews) ? data.design_previews : [],
          orders: Array.isArray(data.order_cards) ? data.order_cards : [],
          suggestions: data.ai_message?.metadata?.page_product?.customizable
            ? [
                ...PRODUCT_CHIPS.slice(0, -1),
                { label: "Customize this product", action: "product_customize" },
                PRODUCT_CHIPS[PRODUCT_CHIPS.length - 1],
              ]
            : undefined,
        },
      ]);

      try {
        await axios.post(
          `${MERN_API_URL}/ai/chat-turns`,
          {
            sessionId,
            userMessage: trimmedMessage,
            assistantMessage: assistantText,
          },
          { headers: requestHeaders }
        );
      } catch {
        // History persistence should not hide an answer that was already received.
      }

      await runCartActions(Array.isArray(data.actions) ? data.actions : []);
    } catch (requestError) {
      console.error("[AI chat request failed]", {
        status: requestError.response?.status ?? null,
        response: requestError.response?.data ?? null,
        message: requestError.message,
      });
      setError(describeChatError(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await sendChatMessage(message);
  };

  const handleSuggestedQuestion = async (chip) => {
    setActiveTab("chat");
    if (chip.action === "ask_else") {
      setMessage("");
      inputRef.current?.focus();
      return;
    }
    await sendChatMessage(chip.label, chip.action);
  };

  const handleResetChat = async () => {
    const previousSessionId = sessionId;
    const previousHeaders = requestHeaders;

    startNewChat();

    try {
      await axios.delete(`${MERN_API_URL}/ai/chat-history/${previousSessionId}`, { headers: previousHeaders });
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
          text: `Added ${product.name} (${selectedSize}) to your cart.`,
          products: [],
          isCartUpdate: true,
        },
      ]);
    } catch (cartError) {
      setError(cartError?.message || "Could not add this product to cart.");
    } finally {
      setAddingProductId("");
    }
  };

  const runCartActions = async (actions) => {
    const results = [];
    for (const action of actions) {
      const label = `${action.name || "Item"}${action.size ? ` (${action.size})` : ""}`;
      try {
        if (action.type === "add_to_cart") {
          await dispatch(addToCart({
            kind: action.kind || "READYMADE",
            readymadeProductId: action.product_id,
            size: action.size,
            qty: action.qty || 1,
          })).unwrap();
          trackBehaviorEvent("ADD_TO_CART_AI", { productId: action.product_id, productName: action.name });
          results.push(`Added ${label}${action.qty > 1 ? ` × ${action.qty}` : ""} to your cart.`);
        } else if (action.type === "update_cart_qty") {
          await dispatch(updateCartItemQty({ itemId: action.item_id, qty: action.qty })).unwrap();
          results.push(`Updated ${action.name || "the item"} to ${action.qty}.`);
        } else if (action.type === "remove_cart_item") {
          await dispatch(removeCartItem(action.item_id)).unwrap();
          results.push(`Removed ${action.name || "the item"} from your cart.`);
        }
      } catch (cartError) {
        results.push(`! Couldn't update your cart for ${label}: ${cartError?.message || "please try again."}`);
      }
    }
    if (!results.length) return;
    dispatch(getCart());
    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "assistant", text: results.join("\n"), products: [], isCartUpdate: true },
    ]);
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

  const renderCartUpdate = (text) => (
    <div className="space-y-1.5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
      {text.split("\n").map((line) => {
        const failed = line.startsWith("! ");
        return (
          <p key={line} className={`flex items-start gap-2 text-[13px] leading-5 ${failed ? "text-red-700" : "text-emerald-800"}`}>
            {failed
              ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              : <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
            <span>{failed ? line.slice(2) : line}</span>
          </p>
        );
      })}
    </div>
  );

  const headerButton = "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-950 disabled:opacity-50";

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {isOpen && (
        <section
          role="dialog"
          aria-label="Maitrova shopping assistant"
          className="mb-3 flex h-[min(640px,calc(100dvh-6.5rem))] w-[calc(100vw-2rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_64px_-12px_rgba(0,0,0,0.25)]"
        >
          <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative shrink-0">
                <AssistantAvatar size="h-9 w-9" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-gray-950">Maitrova Assistant</h2>
                <p className="truncate text-xs text-gray-500">Online · replies instantly</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("chat");
                  sendChatMessage("Talk to a person", "talk_to_human");
                }}
                disabled={isLoading}
                className={headerButton}
                title="Ask our store team to contact you"
              >
                <Headset className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Talk to us</span>
              </button>
              <button
                type="button"
                onClick={handleResetChat}
                className={headerButton}
                title="Start a new chat"
                aria-label="Start a new chat"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={headerButton}
                aria-label="Close chat"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          <nav className="flex gap-1 border-b border-gray-100 px-3" aria-label="Assistant sections">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                aria-current={activeTab === id ? "page" : undefined}
                className={`relative flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-xs font-medium transition ${
                  activeTab === id
                    ? "border-gray-950 text-gray-950"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                {createElement(Icon, { className: "h-3.5 w-3.5", "aria-hidden": "true" })}
                {label}
                {id === "recommendations" && recommendationNoticeCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-950 px-1 text-[10px] font-semibold text-white">
                    {recommendationNoticeCount > 9 ? "9+" : recommendationNoticeCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {activeTab === "chat" && (
            <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50/70 px-4 py-4">
              {messages.map((chatMessage, index) => {
                const isUser = chatMessage.role === "user";
                const previous = messages[index - 1];
                // One avatar per run of assistant messages.
                const showAvatar = !isUser && previous?.role !== "assistant";
                return (
                  <div
                    key={`${chatMessage.role}-${index}`}
                    className={`flex items-start gap-2 ${isUser ? "justify-end" : "justify-start"} ${!isUser && !showAvatar ? "-mt-2" : ""}`}
                  >
                    {!isUser && (showAvatar ? <AssistantAvatar /> : <span className="w-7 shrink-0" aria-hidden="true" />)}
                    <div className={`min-w-0 ${isUser ? "max-w-[80%]" : "max-w-[85%] flex-1 space-y-2"}`}>
                      {chatMessage.isCartUpdate ? (
                        renderCartUpdate(chatMessage.text)
                      ) : (
                        <div
                          className={`w-fit max-w-full whitespace-pre-line break-words px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                            isUser
                              ? "ml-auto rounded-2xl rounded-br-md bg-gray-950 text-white"
                              : "rounded-2xl rounded-tl-md border border-gray-200 bg-white text-gray-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                          }`}
                        >
                          <MessageText text={chatMessage.text} />
                        </div>
                      )}

                      {!isUser && chatMessage.offers?.length > 0 && renderOffers(chatMessage.offers, 3)}

                      {!isUser && chatMessage.products?.length > 0 && renderProducts(chatMessage.products, 3)}

                      {!isUser && chatMessage.orders?.length > 0 && (
                        <div className="space-y-2">
                          {chatMessage.orders.map((order) => (
                            <OrderCard key={order.order_number} order={order} />
                          ))}
                        </div>
                      )}

                      {!isUser && chatMessage.designs?.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {chatMessage.designs.map((design, designIndex) => (
                            <a
                              key={`${design.image}-${designIndex}`}
                              href={toSitePath(design.url) || "/customproducts"}
                              className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-gray-300"
                              title={`Use ${design.name} in the designer`}
                            >
                              <img
                                src={buildImageUrl(design.image)}
                                alt={design.name}
                                className="aspect-square w-full bg-gray-50 object-contain transition group-hover:scale-105"
                                loading="lazy"
                              />
                              <p className="truncate px-1.5 py-1 text-[10px] font-medium text-gray-700">{design.name}</p>
                            </a>
                          ))}
                        </div>
                      )}

                      {!isUser && chatMessage.suggestions?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {chatMessage.suggestions.map((suggestion) => {
                            const label = suggestion.label || suggestion;
                            return (
                              <button
                                key={suggestion.action || suggestion}
                                type="button"
                                onClick={() => handleSuggestedQuestion(suggestion.action ? suggestion : { label: suggestion, action: null })}
                                disabled={isLoading}
                                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-gray-700 transition hover:border-gray-950 hover:text-gray-950 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
          )}

          {activeTab === "recommendations" && (
            <div className="flex-1 space-y-5 overflow-y-auto bg-gray-50/70 px-4 py-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white p-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gray-900" aria-hidden="true" />
                <p className="text-[13px] leading-relaxed text-gray-700">
                  {recommendations.response || "As you browse, picks and offers for the page you're on will appear here."}
                </p>
              </div>

              {recommendations.offers.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Combo offers
                  </h3>
                  {renderOffers(recommendations.offers, 3)}
                </div>
              )}

              {recommendations.products.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Recommended for you
                  </h3>
                  {renderProducts(recommendations.products, 5)}
                </div>
              )}
            </div>
          )}

          {activeTab === "orders" && (
            <div className="flex-1 overflow-y-auto bg-gray-50/70 px-4 py-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                  <PackageSearch className="h-4 w-4 text-gray-900" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-gray-950">Track an order</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
                  {authToken
                    ? "See the status, delivery, refund or return of your recent orders."
                    : "Have your order number (Order #XXXXXXXX) and the email or mobile number used for the order ready, or sign in to see all your orders."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("chat");
                    sendChatMessage(authToken ? "Where is my latest order?" : "I want to track my order");
                  }}
                  disabled={isLoading}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-gray-950 px-4 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  Track my order
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 border-t border-red-100 bg-red-50 px-4 py-2 text-xs leading-5 text-red-700" role="alert">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t border-gray-100 bg-white px-3 pb-2 pt-3">
            <div className="flex items-center gap-2 rounded-full border border-gray-300 bg-white py-1 pl-4 pr-1 transition focus-within:border-gray-950 focus-within:ring-2 focus-within:ring-gray-950/10">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ask about products, sizes or orders…"
                aria-label="Message"
                className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
              <button
                type="submit"
                disabled={isLoading || !message.trim()}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-950 text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                aria-label="Send message"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-gray-400">
              AI assistant · it can make mistakes, so check details before you order
            </p>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="relative ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-950 text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.45)] transition hover:scale-105 hover:bg-gray-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-950/20"
        aria-label={isOpen ? "Close chat" : "Chat with the Maitrova assistant"}
        aria-expanded={isOpen}
      >
        {recommendationNoticeCount > 0 && !isOpen && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-gray-950 ring-2 ring-gray-950">
            {recommendationNoticeCount > 9 ? "9+" : recommendationNoticeCount}
          </span>
        )}
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
