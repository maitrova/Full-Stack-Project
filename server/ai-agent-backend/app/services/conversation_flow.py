"""Deterministic conversation flow state for every chat channel."""

SEARCH_RESET_KEYS = (
    "selected_product_id",
    "recommended_product_ids",
    "option_product_ids",
    "option_products",
    "pending_product_action",
    "purchase",
    "last_declined_purchase",
    "last_search_had_results",
    "last_offer_type",
    "last_image_analysis",
    "last_order_id",
    "last_cart_update",
    "last_checkout_purchase",
)


def reset_search_context(state: dict) -> None:
    """Remove transactional context that must not leak into a new search."""
    for key in SEARCH_RESET_KEYS:
        state.pop(key, None)


def sync_flow_state(state: dict) -> str:
    """Derive one authoritative phase from validated conversation state."""
    purchase = state.get("purchase") or {}
    if state.get("handoff_requested"):
        phase = "human_handoff"
    elif purchase.get("confirmed_quote") is not None or purchase.get("confirmed_items"):
        phase = "awaiting_cart_confirmation"
    elif purchase:
        phase = "collecting_variant"
    elif state.get("last_checkout_purchase"):
        phase = "account_linking"
    elif state.get("last_cart_update"):
        phase = "cart_updated"
    elif state.get("selected_product_id"):
        phase = "product_selected"
    else:
        phase = "browsing"

    previous = state.get("flow_phase")
    if previous and previous != phase:
        state["flow_previous_phase"] = previous
    state["flow_phase"] = phase
    return phase
