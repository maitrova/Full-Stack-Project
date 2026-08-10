import os

from dotenv import load_dotenv


# Loads environment variables from the .env file into this Python process.
load_dotenv()


class Settings:
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    MERN_API_URL: str = os.getenv("MERN_API_URL", "http://localhost:5000/api").rstrip("/")
    MERN_PRODUCTS_LIMIT: int = int(os.getenv("MERN_PRODUCTS_LIMIT", "100"))
    FRONTEND_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]


settings = Settings()
