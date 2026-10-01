import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit

import httpx

from app.config.settings import settings


class UnsafeRemoteMedia(ValueError):
    pass


def _allowed_hosts() -> set[str]:
    hosts = {
        urlsplit(value).hostname.lower()
        for value in (settings.ecommerce_public_url, settings.ecommerce_storefront_url)
        if value and urlsplit(value).hostname
    }
    hosts.update(
        value.strip().lower().rstrip(".")
        for value in settings.remote_image_allowed_hosts.split(",")
        if value.strip()
    )
    return hosts


async def validate_remote_image_url(url: str) -> str:
    parsed = urlsplit(str(url).strip())
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or not hostname or parsed.username or parsed.password:
        raise UnsafeRemoteMedia("Remote images must use an HTTPS URL without credentials")
    if parsed.port not in (None, 443):
        raise UnsafeRemoteMedia("Remote image ports are restricted")
    allowed = _allowed_hosts()
    if hostname not in allowed:
        raise UnsafeRemoteMedia("Remote image host is not allowlisted")

    loop = asyncio.get_running_loop()
    addresses = await loop.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise UnsafeRemoteMedia("Remote image host resolves to a non-public address")
    return parsed.geturl()


async def fetch_remote_image(url: str) -> tuple[bytes, str, str]:
    safe_url = await validate_remote_image_url(url)
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        response = await client.get(safe_url, headers={"Accept": "image/*"})
        if response.is_redirect:
            location = response.headers.get("location")
            if not location:
                raise UnsafeRemoteMedia("Remote image redirect has no destination")
            redirected = str(response.url.join(location))
            await validate_remote_image_url(redirected)
            response = await client.get(redirected, headers={"Accept": "image/*"})
        response.raise_for_status()
    if len(response.content) > settings.remote_image_max_bytes:
        raise UnsafeRemoteMedia("Remote image exceeds the configured size limit")
    content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        raise UnsafeRemoteMedia("Remote resource is not a supported image")
    return response.content, content_type, str(response.url)
