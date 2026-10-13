"""Deterministic capability routing before any commerce tool is called."""

from dataclasses import dataclass

from app.schemas.ai import IntentResult


@dataclass(frozen=True)
class RouteDecision:
    route: str
    allowed: bool = True
    reason: str | None = None


class ToolRouter:
    """Classify requests separately from action authorization/execution."""

    ACTION_ROUTES = {
        "add_to_cart": "cart",
        "confirm_cart": "cart_confirmation",
        "decline_cart": "cart_decline",
        "show_cart": "cart",
        "remove_from_cart": "cart",
        "update_cart_quantity": "cart",
        "checkout": "checkout",
        "retry_checkout": "checkout",
        "track_order": "order_tracking",
        "human_handoff": "human_handoff",
        "browse_designs": "customization",
        "product_photos": "product_catalogue",
        "product_link": "product_catalogue",
        "check_price": "product_catalogue",
        "check_stock": "product_catalogue",
        "show_sizes": "product_catalogue",
    }

    @classmethod
    def classify(cls, intent: IntentResult) -> RouteDecision:
        """Pure route classification. This method never reads or mutates state."""
        action = intent.action
        if action:
            route = cls.ACTION_ROUTES.get(action)
            if route is None:
                return RouteDecision("clarification", False, "The requested action is not supported.")
            return RouteDecision(route)

        if intent.intent == "product_search":
            return RouteDecision("product_catalogue")
        if intent.intent == "store_question":
            return RouteDecision("store_knowledge")
        if intent.intent == "general_question":
            return RouteDecision("clarification", False, "The request needs clarification.")
        return RouteDecision("clarification", False, "The request could not be safely classified.")

    @classmethod
    def decide(cls, intent: IntentResult, state: dict, conversation: dict) -> RouteDecision:
        """Backward-compatible classify + authorization decision for callers."""
        decision = cls.classify(intent)
        if not decision.allowed:
            return decision
        action = intent.action
        if action == "confirm_cart" and not state.get("purchase"):
            return RouteDecision("clarification", False, "There is no pending cart quote to confirm.")
        if action in {"add_to_cart", "checkout"} and not (
            state.get("selected_product_id")
            or conversation.get("selected_product_id")
            or state.get("purchase")
            or intent.product_option
        ):
            return RouteDecision("clarification", False, "A product must be selected first.")
        return decision
