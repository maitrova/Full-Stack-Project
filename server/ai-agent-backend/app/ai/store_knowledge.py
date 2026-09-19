"""Ground store answers in published information, never model assumptions."""
import html
import logging
import re

logger = logging.getLogger(__name__)


class StoreKnowledge:
    TOPICS = {
        "delivery": r"\b(shipping|delivery|deliver|arrive|arrival|reach|shipping fee|postage|pincode|pin code|how long|how many days)\b",
        "returns": r"\b(return|returns|exchange|exchanges|refund|refunds|cancellation|cancel)\b",
        "payment": r"\b(payment|payments|pay|cod|cash on delivery|upi|discount|coupon|offer)\b",
        "contact": r"\b(contact|phone|email|address|location|located|opening|hours|support|complaint)\b",
        "about": r"\b(about (?:your|the|this) (?:store|shop|brand)|who are you|what do you sell|store policy|policies|authentic|legit|safe to shop|privacy|terms|warranty|faq)\b",
        "care": r"\b(wash|washing|care|shrink|shrinkage|size chart|measurement|measurements)\b",
    }
    DOCUMENT_TOPICS = {
        "delivery": "shipping|delivery",
        "returns": "return|refund|exchange|cancel",
        "payment": "payment|discount|coupon|offer|terms",
        "contact": "contact|about|support",
        "about": "about|terms|privacy",
        "care": "care|size|faq",
    }

    def __init__(self, database=None):
        self.db = database

    @classmethod
    def topics(cls, message):
        return [topic for topic, pattern in cls.TOPICS.items() if re.search(pattern, message.lower())]

    @classmethod
    def is_store_question(cls, message):
        return bool(cls.topics(message))

    async def load(self, business, message, include_all=False):
        topics = self.topics(message)
        if include_all and not topics:
            topics = list(self.TOPICS)
        context = {
            "business": {key: business[key] for key in ("business_name", "description", "phone", "email", "currency") if business.get(key)},
            "topics": topics,
            "published_information": [],
        }
        if not topics or self.db is None:
            return context
        try:
            query = {"name": {"$regex": "|".join(self.DOCUMENT_TOPICS[topic] for topic in topics), "$options": "i"}}
            docs = await self.db.companydocuments.find(query).limit(8).to_list(8)
            for doc in docs:
                content = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", "", str(doc.get("content") or ""), flags=re.S | re.I)
                content = re.sub(r"<[^>]+>", " ", content)
                content = re.sub(r"\s+", " ", html.unescape(content)).strip()
                if content:
                    context["published_information"].append({"title": str(doc.get("name") or "Store information"), "content": content[:6000], "truncated": len(content) > 6000})
        except Exception as exc:
            logger.warning("Store information unavailable: %s", exc.__class__.__name__)
        return context

    @staticmethod
    def fallback(context):
        docs = context.get("published_information", [])
        if docs:
            # Preserve actual policy wording when the language model is unavailable.
            return "\n\n".join(f"{doc['title']}: {doc['content'][:900]}" + ("... Please ask the store team for the full details." if len(doc['content']) > 900 else "") for doc in docs)[:3500]
        business = context.get("business", {})
        topics = context.get("topics", [])
        if topics and all(topic in {"contact", "about"} for topic in topics):
            details = [str(business[key]) for key in ("business_name", "description", "phone", "email") if business.get(key)]
            if details:
                return "\n".join(details) + "\nIf you need more details, send 'human' to ask the store team."
        return "I don't have confirmed details for that yet. Send 'human' and I'll flag your question for the store team."
