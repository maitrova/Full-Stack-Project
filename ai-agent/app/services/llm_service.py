from google import genai
from google.genai import types

from app.config import settings
from app.services.product_context import build_product_context
from app.services.product_search import search_products


# 3. The system instruction tells the LLM how it should behave in this app.
SYSTEM_INSTRUCTION = (
    "You are an AI shopping assistant for an e-commerce fashion website. "
    "Help customers understand and find products from the sample product context when it is relevant. "
    "At this stage you cannot access the live product database or perform actions like adding to cart. "
    "If the sample products do not match the request, say that the sample catalog is limited."
)


async def get_llm_response(user_message: str) -> str:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing. Add it to your .env file.")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    matching_products = await search_products(user_message)
    product_context = build_product_context(matching_products)
    prompt = (
        "Matching sample products from Python search:\n"
        f"{product_context or 'No matching sample products found.'}\n\n"
        "Customer message:\n"
        f"{user_message}"
    )

    # 2. This is where we call the Gemini LLM API.
    response = await client.aio.models.generate_content(
        model=settings.GEMINI_MODEL,
        # 4. The user message is sent with products matched by simple Python search.
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
        ),
    )

    # 5. The LLM response comes back from Gemini in response.text.
    return response.text or ""
