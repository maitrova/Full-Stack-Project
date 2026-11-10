"""When the store team answers chats, and what to tell customers outside those hours."""

from datetime import datetime, timezone

from app.services.order_lookup import IST

OPENS_AT_HOUR_IST = 9
CLOSES_AT_HOUR_IST = 17

AFTER_HOURS_NOTES = {
    "English": "Our team is available only from 9 AM to 5 PM IST, so they'll reply once they're back.",
    "Roman Telugu": "Maa team 9 AM nundi 5 PM IST varaku matrame available untundi, kabatti team vachaka meeku reply istaru.",
    "Telugu": "మా టీమ్ ఉదయం 9 నుండి సాయంత్రం 5 గంటల (IST) వరకు మాత్రమే అందుబాటులో ఉంటుంది. టీమ్ వచ్చాక మీకు రిప్లై ఇస్తారు.",
    "Hinglish": "Hamari team sirf 9 AM se 5 PM IST tak available rehti hai, isliye team aane par aapko reply karegi.",
    "Hindi": "हमारी टीम केवल सुबह 9 बजे से शाम 5 बजे (IST) तक उपलब्ध रहती है। टीम के आने पर आपको जवाब मिलेगा।",
}


def is_team_available(now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    return OPENS_AT_HOUR_IST <= now.astimezone(IST).hour < CLOSES_AT_HOUR_IST


def with_team_hours_note(reply: str, language: str | None, now: datetime | None = None) -> str:
    """Adds the team's hours to a "we've told the team" reply when they are away."""
    if is_team_available(now):
        return reply
    note = AFTER_HOURS_NOTES.get(language or "") or AFTER_HOURS_NOTES["English"]
    return f"{reply}\n\n{note}"
