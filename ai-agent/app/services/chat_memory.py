MAX_HISTORY_MESSAGES = 8

_chat_sessions: dict[str, list[dict[str, str]]] = {}


def get_chat_history(session_id: str) -> list[dict[str, str]]:
    return _chat_sessions.get(session_id, []).copy()


def save_chat_turn(session_id: str, user_message: str, assistant_message: str) -> None:
    history = _chat_sessions.setdefault(session_id, [])
    history.extend(
        [
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": assistant_message},
        ]
    )

    _chat_sessions[session_id] = history[-MAX_HISTORY_MESSAGES:]


def clear_chat_history(session_id: str) -> None:
    _chat_sessions.pop(session_id, None)
