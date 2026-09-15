import re


TELUGU_SCRIPT_RE = re.compile(r"[\u0c00-\u0c7f]")
DEVANAGARI_SCRIPT_RE = re.compile(r"[\u0900-\u097f]")

ROMAN_TELUGU_TERMS = {
    "bagundi",
    "bagunnaya",
    "cheera",
    "cheppu",
    "chupinchu",
    "chupinchandi",
    "dorukutunda",
    "inka",
    "ivvandi",
    "kavali",
    "kavala",
    "ki",
    "koncham",
    "lo",
    "nachindi",
    "undi",
    "undha",
    "unda",
    "unnaya",
    "telupu",
}

ROMAN_HINDI_TERMS = {
    "acha",
    "achha",
    "chahiye",
    "dikhao",
    "dikhana",
    "hai",
    "kya",
    "mehenga",
    "sasta",
    "shaadi",
}


def detect_customer_language(message: str) -> dict[str, str]:
    text = message.strip()
    lowered = text.lower()
    words = set(re.findall(r"[a-z]+", lowered))

    if TELUGU_SCRIPT_RE.search(text):
        return {
            "language": "Telugu",
            "script": "Telugu",
            "reply_instruction": "Reply in Telugu using Telugu script.",
        }

    if DEVANAGARI_SCRIPT_RE.search(text):
        return {
            "language": "Hindi",
            "script": "Devanagari",
            "reply_instruction": "Reply in Hindi using Devanagari script.",
        }

    if words & ROMAN_TELUGU_TERMS:
        return {
            "language": "Telugu-English",
            "script": "Latin",
            "reply_instruction": (
                "Reply in the same Roman Telugu plus English mix. Use Telugu words in Latin script, "
                "and do not switch to only English."
            ),
        }

    if words & ROMAN_HINDI_TERMS:
        return {
            "language": "Hindi-English",
            "script": "Latin",
            "reply_instruction": (
                "Reply in the same Hinglish style. Use Hindi words in Latin script, "
                "and do not switch to only English."
            ),
        }

    return {
        "language": "English",
        "script": "Latin",
        "reply_instruction": "Reply in the same language and tone as the customer.",
    }
