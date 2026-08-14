import asyncio
import traceback

from google import genai

from app.config import settings


async def main():
    print(f"GEMINI_MODEL={settings.GEMINI_MODEL}")
    print(f"GEMINI_API_KEY_SET={bool(settings.GEMINI_API_KEY)}")

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents="Reply with OK only.",
        )
        print("GEMINI_RESPONSE=", response.text)
    except Exception as error:
        print("GEMINI_ERROR_TYPE=", type(error).__name__)
        print("GEMINI_ERROR=", error)
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
