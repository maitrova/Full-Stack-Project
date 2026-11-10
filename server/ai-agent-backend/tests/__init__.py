from app.services import handoff_email

# No test may email the store team, even with a real key and server running
# locally. test_handoff_email exercises the real sender through real_send.
real_send = handoff_email._send


async def _no_send(_payload: dict) -> None:
    return None


handoff_email._send = _no_send
