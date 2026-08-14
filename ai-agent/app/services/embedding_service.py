import math

from google import genai

from app.config import settings


_embedding_cache: dict[str, list[float]] = {}


def build_product_embedding_text(product: dict) -> str:
    return " | ".join(
        [
            f"Name: {product.get('name', '')}",
            f"Category: {product.get('category', '')}",
            f"Subcategory: {product.get('subCategory', '')}",
            f"Color: {product.get('color', '')}",
            f"Sizes: {', '.join(product.get('sizes', []))}",
            f"Price: {product.get('price', '')}",
            f"Description: {product.get('description', '')}",
        ]
    )


def _embedding_values(embedding_response) -> list[float]:
    embeddings = getattr(embedding_response, "embeddings", None) or []
    if not embeddings:
        return []

    first_embedding = embeddings[0]
    values = getattr(first_embedding, "values", None)
    if values is not None:
        return list(values)

    if isinstance(first_embedding, dict):
        return list(first_embedding.get("values", []))

    return []


async def embed_text(text: str) -> list[float]:
    cache_key = f"{settings.GEMINI_EMBEDDING_MODEL}:{text}"
    if cache_key in _embedding_cache:
        return _embedding_cache[cache_key]

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    response = await client.aio.models.embed_content(
        model=settings.GEMINI_EMBEDDING_MODEL,
        contents=text,
    )
    values = _embedding_values(response)
    _embedding_cache[cache_key] = values
    return values


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0

    dot_product = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))

    if left_norm == 0 or right_norm == 0:
        return 0.0

    return dot_product / (left_norm * right_norm)


async def rank_products_by_embedding(query: str, products: list[dict]) -> list[dict]:
    if not settings.USE_EMBEDDING_SEARCH or not products:
        return products

    try:
        query_embedding = await embed_text(query)
        scored_products = []

        for product in products:
            product_embedding = await embed_text(build_product_embedding_text(product))
            similarity = cosine_similarity(query_embedding, product_embedding)
            scored_product = {
                **product,
                "similarityScore": round(similarity, 4),
            }
            scored_products.append((similarity, scored_product))

        scored_products.sort(key=lambda item: item[0], reverse=True)
        return [product for score, product in scored_products]
    except Exception:
        # Embeddings improve ranking, but normal search should still work if the embedding API fails.
        return products
