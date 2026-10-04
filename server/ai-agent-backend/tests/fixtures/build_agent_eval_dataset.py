"""Generate a deterministic 200-case synthetic agent evaluation dataset."""
import json
from pathlib import Path

OUT = Path(__file__).with_name("agent_eval_cases_200.json")

specs = [
    ("product_search", "product_search", "search_products", "I need {item}", "Find the requested product before discussing checkout."),
    ("product_recommendation", "product_recommendation", "search_products", "show me some {item}", "Show verified recommendations."),
    ("typo_search", "product_search", "search_products", "show {item_typo}", "Correct spelling mistakes without changing the request."),
    ("price", "check_price", "check_price", "what is the price of option {n}", "Use the selected product and verified price only."),
    ("stock", "check_stock", "check_stock", "is option {n} available in {size}", "Check live variant stock."),
    ("photos", "product_photos", "show_photos", "send photos of option {n}", "Send only verified product images."),
    ("link", "product_link", "show_product_link", "send me the link for option {n}", "Send the verified product URL."),
    ("cart", "add_to_cart", "add_to_cart", "add option {n} to my cart", "Do not claim success until the cart tool confirms it."),
    ("confirm", "confirm_cart", "confirm_cart", "yes, add it", "Confirm only a pending cart action."),
    ("checkout", "checkout", "checkout", "take me to checkout", "Send the secure checkout flow."),
    ("tracking", "track_order", "track_order", "where is my order?", "Use order data; never invent tracking status."),
    ("delivery", "store_question", "none", "how long does delivery take?", "Answer only from published store information."),
    ("returns", "store_question", "none", "what is your return policy?", "Answer only from published store information."),
    ("payment", "store_question", "none", "do you accept cash on delivery?", "Answer only from published store information."),
    ("contact", "store_question", "none", "how can I contact the store?", "Use verified contact information only."),
    ("customization", "customization", "search_products", "I want my {design} on a {item}", "Show customizable base products and explain designer options."),
    ("uploaded_image", "customization", "search_products", "put this image on my {item}", "Explain that the image may need to be uploaded again in the designer."),
    ("design_library", "design_library", "browse_designs", "what designs do you have?", "Show the verified design-library link or options."),
    ("handoff", "human_handoff", "create_handoff", "please ask the customization team to contact me", "Create a high-priority customization handoff."),
    ("unsupported", "unsupported", "none", "can you give me medical advice?", "Do not answer outside store capabilities; offer safe help or handoff."),
]

variants = [
    ("English", {"item": "white cotton shirts", "item_typo": "whit cottn shirts", "design": "logo", "n": "2", "size": "L"}),
    ("English", {"item": "black polo T-shirts under 1500", "item_typo": "blak poloo tshrits", "design": "name", "n": "1", "size": "XL"}),
    ("Telugu-English", {"item": "white shirts kavali", "item_typo": "blak tshrit kavali", "design": "my photo", "n": "3", "size": "M"}),
    ("Hindi-English", {"item": "black hoodie chahiye", "item_typo": "whte shirt chahiye", "design": "mera logo", "n": "2", "size": "S"}),
    ("Telugu", {"item": "చొక్కా", "item_typo": "షర్ట్", "design": "నా లోగో", "n": "1", "size": "L"}),
    ("Hindi", {"item": "सफेद शर्ट", "item_typo": "सफेद शर्ट", "design": "मेरा नाम", "n": "3", "size": "XL"}),
    ("English", {"item": "oversized hoodies", "item_typo": "oversizd hodie", "design": "artwork", "n": "2", "size": "M"}),
    ("English", {"item": "wedding sarees", "item_typo": "weding sarees", "design": "photo", "n": "1", "size": "Free size"}),
    ("Roman Telugu", {"item": "white shirt kavali", "item_typo": "telupu shrt kavali", "design": "na photo", "n": "2", "size": "L"}),
    ("Hinglish", {"item": "shaadi ke liye saree chahiye", "item_typo": "saree dikhwo", "design": "mera photo", "n": "3", "size": "Free size"}),
]

cases = []
for row, (scenario, route, action, template, notes) in enumerate(specs):
    for variant, values in variants:
        index = len(cases) + 1
        message = template.format(**values)
        context = {}
        if route in {"price", "check_price"} or scenario == "price":
            context = {"recommended_products": 3}
        elif route in {"product_selection", "check_stock", "product_photos", "product_link"}:
            context = {"recommended_products": 3, "selected_product": True}
        elif route in {"confirm_cart", "checkout"}:
            context = {"pending_purchase": True}
        entity = {"category": None, "color": None, "size": None, "max_price": None, "occasion": None, "catalog_type": None}
        if "shirt" in message.lower() or "చొక్కా" in message or "शर्ट" in message:
            entity["category"] = "shirt"
        if "hoodie" in message.lower() or "hodie" in message.lower():
            entity["category"] = "hoodie"
        if "saree" in message.lower() or "साड़ी" in message or "saree" in message.lower():
            entity["category"] = "saree"
        if "white" in message.lower() or "telupu" in message.lower() or "सफेद" in message:
            entity["color"] = "white"
        if "black" in message.lower() or "blak" in message.lower():
            entity["color"] = "black"
        if route == "customization" or scenario in {"customization", "uploaded_image"}:
            entity["catalog_type"] = "customization"
        cases.append({
            "id": f"case-{index:03d}",
            "conversation": [message],
            "language": variant,
            "scenario": scenario,
            "expected_route": route,
            "expected_intent": "commerce_action" if route in {"price", "check_stock", "product_photos", "product_link", "cart", "confirm", "checkout", "tracking", "handoff"} else route,
            "expected_action": action,
            "expected_entities": entity,
            "context": context,
            "requires_tool": action != "none",
            "expected_tool": action,
            "requires_confirmation": route in {"add_to_cart", "checkout"},
            "expected_handoff": route == "human_handoff",
            "expected_handoff_priority": "high" if route == "human_handoff" else None,
            "must_not_claim": ["order placed", "invented price", "invented stock", "invented URL"],
            "evaluation_notes": notes,
        })

assert len(cases) == 200
OUT.write_text(json.dumps(cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(cases)} cases to {OUT}")
