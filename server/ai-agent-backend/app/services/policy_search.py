"""Find the policy sections that answer a shopper's question.

Sources are the store's published pages (the `companydocuments` collection that
the storefront's policy pages render) plus any synced website knowledge. Each
document is split into its numbered sections and ranked by word overlap with
the question, so the answer comes from the right section rather than from the
first characters of a long page.
"""

import hashlib
import html
import math
import re
from urllib.parse import quote

from app.config.settings import settings

STOPWORDS = {
    "a", "an", "and", "any", "are", "can", "could", "do", "does", "for", "from", "have", "how", "i", "if", "in",
    "is", "it", "me", "my", "of", "on", "or", "please", "the", "this", "to", "u", "what", "where", "which",
    "will", "with", "you", "your", "about", "tell", "policy", "maitrova", "there", "be", "get", "much",
}
SYNONYMS = {
    "ship": ["shipping", "delivery", "dispatch"], "deliver": ["delivery", "shipping"], "arrive": ["delivery"],
    "money": ["refund"], "refund": ["refund"], "cancel": ["cancellation", "cancel"], "exchange": ["exchange", "size"],
    "cod": ["cash", "delivery"], "track": ["tracking", "dispatch"], "late": ["delay"], "delay": ["delay"],
    "damage": ["damaged", "defective"], "broken": ["damaged", "defective"], "torn": ["damaged", "defective"],
    "wrong": ["wrong", "incorrect"], "pay": ["payment"], "upi": ["upi", "payment"], "card": ["card", "payment"],
    "contact": ["contact", "support", "email"], "email": ["email", "support"], "phone": ["phone", "contact"],
    "custom": ["customized", "customization", "personalized"], "print": ["print", "customized"],
    "abroad": ["india"], "international": ["india"], "outside": ["india"], "dubai": ["india"], "usa": ["india"],
    "uk": ["india"], "country": ["india"], "fee": ["charges"], "charge": ["charges"], "free": ["free", "charges"],
    "when": ["timeline", "time", "days"], "long": ["timeline", "time", "days"], "day": ["timeline", "days"],
    "soon": ["timeline", "time"], "wash": ["wash", "care"], "privacy": ["privacy", "data"], "data": ["data", "privacy"],
}
SECTION_HEADING_RE = re.compile(r"^\s*(?:\d+[.)]\s+\S|[A-Z][A-Z &/,\-–()]{5,}$)")
MAX_SECTION_CHARS = 1400


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", str(text or "").lower())


def question_terms(question: str) -> set[str]:
    terms = {word for word in _words(question) if word not in STOPWORDS and len(word) > 1}
    for word in list(terms):
        for key, extra in SYNONYMS.items():
            if word.startswith(key):
                terms.update(extra)
    return terms


def _matches(term: str, word: str) -> bool:
    if term == word:
        return True
    stem = term[:6] if len(term) > 6 else term
    return len(term) >= 4 and word.startswith(stem)


def html_to_text(content: str) -> str:
    text = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", str(content or ""), flags=re.S | re.I)
    text = re.sub(r"<(br|/p|/li|/h[1-6]|/div|/tr)[^>]*>", "\n", text, flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    text = re.sub(r"[ \t ]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n", text).strip()


def split_sections(title: str, text: str) -> list[dict]:
    sections: list[dict] = []
    heading, lines = title, []

    def flush():
        body = "\n".join(lines).strip()
        while body:
            sections.append({"heading": heading, "content": body[:MAX_SECTION_CHARS]})
            body = body[MAX_SECTION_CHARS:].strip()

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        if SECTION_HEADING_RE.match(line) and len(line) < 90:
            flush()
            heading, lines = line, []
        else:
            lines.append(line)
    flush()
    return sections


def _page_url(name: str) -> str | None:
    storefront = str(settings.ecommerce_storefront_url or "").rstrip("/")
    if not storefront.startswith("https://") or not re.fullmatch(r"[a-z0-9-]+", name or ""):
        return None
    return f"{storefront}/{quote(name)}"


async def search_policies(database, question: str, limit: int = 4) -> list[dict]:
    terms = question_terms(question)
    documents = await database.companydocuments.find({}, {"name": 1, "content": 1}).limit(100).to_list(100)
    # Prefer slug-named documents ("return-refund-policy") when the same
    # content was saved under several names ("Contact", "Contact Support").
    documents.sort(key=lambda item: 0 if re.fullmatch(r"[a-z0-9-]+", str(item.get("name") or "")) else 1)
    candidates: list[dict] = []
    for document in documents:
        name = str(document.get("name") or "")
        title = name.replace("-", " ").title()
        for section in split_sections(title, html_to_text(document.get("content"))):
            candidates.append({**section, "title": title, "source_url": _page_url(name)})
    website = await database.ai_website_knowledge.find({"status": "active"}, {"title": 1, "content": 1, "source_url": 1}).limit(200).to_list(200)
    for chunk in website:
        candidates.append({
            "title": str(chunk.get("title") or "Website information"),
            "heading": str(chunk.get("title") or ""),
            "content": str(chunk.get("content") or "")[:MAX_SECTION_CHARS],
            "source_url": chunk.get("source_url"),
        })

    seen: set[str] = set()
    unique = []
    for candidate in candidates:
        fingerprint = hashlib.sha256(re.sub(r"\s+", " ", candidate["content"]).lower().encode()).hexdigest()
        if fingerprint not in seen:
            seen.add(fingerprint)
            candidate["heading_words"] = set(_words(f"{candidate['title']} {candidate['heading']}"))
            candidate["body_words"] = set(_words(candidate["content"]))
            unique.append(candidate)
    if not unique:
        return []

    # Rare words ("refund", "cod") say more than words found in most sections
    # ("order", "product"), so weight each term by inverse section frequency.
    def found(term: str, candidate: dict) -> bool:
        return any(_matches(term, word) for word in candidate["heading_words"] | candidate["body_words"])

    weights = {
        term: math.log((1 + len(unique)) / (1 + sum(found(term, candidate) for candidate in unique))) + 0.1
        for term in terms
    }
    scored = []
    for candidate in unique:
        score = 0.0
        for term in terms:
            if any(_matches(term, word) for word in candidate["heading_words"]):
                score += 2.0 * weights[term]
            if any(_matches(term, word) for word in candidate["body_words"]):
                score += weights[term]
        if score > 0:
            scored.append((score, candidate))
    scored.sort(key=lambda item: -item[0])
    return [
        {"page": candidate["title"], "section": candidate["heading"], "content": candidate["content"], "source_url": candidate["source_url"]}
        for _, candidate in scored[:limit]
    ]
