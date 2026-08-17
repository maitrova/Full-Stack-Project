import httpx

from app.config import settings


def _headers(auth_token: str | None, session_id: str) -> dict:
    headers = {"x-ai-session-id": session_id}

    if auth_token:
        token = auth_token.replace("Bearer ", "").strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"

    return headers


async def fetch_persistent_chat_history(
    session_id: str,
    auth_token: str | None = None,
) -> list[dict[str, str]]:
    url = f"{settings.MERN_API_URL}/ai/chat-history/{session_id}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, headers=_headers(auth_token, session_id))
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return []

    messages = payload.get("data", {}).get("messages", [])
    if not isinstance(messages, list):
        return []

    return [
        {
            "role": str(message.get("role") or ""),
            "content": str(message.get("content") or ""),
        }
        for message in messages
        if message.get("role") in {"user", "assistant"} and message.get("content")
    ]


async def save_persistent_chat_turn(
    session_id: str,
    user_message: str,
    assistant_message: str,
    auth_token: str | None = None,
) -> None:
    url = f"{settings.MERN_API_URL}/ai/chat-turns"
    body = {
        "sessionId": session_id,
        "userMessage": user_message,
        "assistantMessage": assistant_message,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                url,
                json=body,
                headers=_headers(auth_token, session_id),
            )
            response.raise_for_status()
    except Exception:
        # Permanent chat history is useful, but the live chat should still work if saving fails.
        return


async def clear_persistent_chat_history(
    session_id: str,
    auth_token: str | None = None,
) -> None:
    url = f"{settings.MERN_API_URL}/ai/chat-history/{session_id}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.delete(url, headers=_headers(auth_token, session_id))
            response.raise_for_status()
    except Exception:
        return
