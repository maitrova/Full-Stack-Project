"""Policy gate for actions that can change customer or order state."""

from app.schemas.ai import IntentResult


class ActionPolicy:
    """Keep model/parser output from authorizing unsafe commerce mutations."""

    @staticmethod
    def validate(intent: IntentResult, conversation: dict, state: dict) -> tuple[bool, str | None]:
        action = intent.action
        if action is None:
            return True, None

        selected_product = (
            state.get("selected_product_id")
            or conversation.get("selected_product_id")
            or intent.product_option
        )
        pending_purchase = bool(state.get("purchase"))

        if action == "add_to_cart" and not selected_product:
            return False, "A product must be selected before adding it to the cart."
        if action == "confirm_cart" and not pending_purchase:
            return False, "A cart quote must exist before it can be confirmed."
        if action == "checkout" and not (selected_product or pending_purchase):
            return False, "A selected product or pending cart is required before checkout."
        if action in {"remove_from_cart", "update_cart_quantity"} and not pending_purchase:
            return False, "An active cart item is required for this action."
        return True, None
