import ipaddress
import os
import re
from html import escape
from typing import Any, Dict, List, Optional
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

CONTROL_CHAR_RE = re.compile(r'[\x00-\x1f\x7f]+')


def sanitize_value(value: Any) -> Any:
    if isinstance(value, str):
        text = CONTROL_CHAR_RE.sub('', value).strip()
        return escape(text)
    if isinstance(value, dict):
        return sanitize_dict(value)
    if isinstance(value, list):
        return [sanitize_value(item) for item in value]
    return value


def sanitize_dict(value: Dict[str, Any]) -> Dict[str, Any]:
    return {k: sanitize_value(v) for k, v in value.items()}


_trusted_proxy_networks_cache: Optional[List] = None
_trusted_proxy_configured: Optional[bool] = None


def _trusted_proxy_networks() -> List:
    global _trusted_proxy_networks_cache, _trusted_proxy_configured
    if _trusted_proxy_networks_cache is None:
        raw = os.environ.get('TRUSTED_PROXY_IPS', '')
        _trusted_proxy_configured = bool(raw.strip())
        networks = []
        for part in raw.split(','):
            part = part.strip()
            if not part:
                continue
            try:
                networks.append(ipaddress.ip_network(part, strict=False))
            except ValueError:
                pass
        _trusted_proxy_networks_cache = networks
    return _trusted_proxy_networks_cache


_CSV_FORMULA_LEAD_CHARS = ('=', '+', '-', '@', '\t', '\r')


def csv_safe(value: Any) -> Any:
    """Neutralizes CSV/formula injection: a cell starting with =, +, -, @ (or a tab/CR that can
    push a formula char to the start once opened) is interpreted as a formula by Excel/Sheets,
    not literal text - e.g. a product name of "=HYPERLINK(...)" could run arbitrary formulas in
    whoever's spreadsheet later opens an admin CSV export. Prefixing with a single quote forces
    it to display as literal text instead."""
    if isinstance(value, str) and value.startswith(_CSV_FORMULA_LEAD_CHARS):
        return "'" + value
    return value


def get_client_ip(request: Request) -> str:
    """Returns the caller's real IP, used to key rate limiting and audit logs - so this must not
    be spoofable. Two independent protections:

    1. Reads the RIGHTMOST entry of X-Forwarded-For, not the leftmost. The leftmost entry is
       whatever the client itself sent (attacker-controlled if they set their own header); each
       hop appends its observed peer to the right, so the rightmost is the one our own reverse
       proxy/PaaS edge actually saw.
    2. If TRUSTED_PROXY_IPS (comma-separated IPs/CIDRs) is set, X-Forwarded-For is only honored
       when the immediate TCP peer (request.client.host) is in that list - otherwise it's ignored
       entirely in favor of request.client.host. Left unset, the header is trusted from any peer,
       which is required while hosted on a PaaS (e.g. Render) whose edge is the only way to reach
       this app - the container is never directly internet-reachable there, so there's no
       untrusted hop to guard against. Set this once self-hosting behind a known reverse proxy
       (e.g. Nginx Proxy Manager) whose IP/subnet you control.
    """
    client_host = request.client.host if request.client else None
    forwarded = request.headers.get('x-forwarded-for')
    if forwarded:
        trust = True
        if _trusted_proxy_configured is None:
            _trusted_proxy_networks()
        if _trusted_proxy_configured:
            trust = False
            if client_host:
                try:
                    peer = ipaddress.ip_address(client_host)
                    trust = any(peer in net for net in _trusted_proxy_networks())
                except ValueError:
                    trust = False
        if trust:
            parts = [p.strip() for p in forwarded.split(',') if p.strip()]
            if parts:
                return parts[-1]
    return client_host or 'unknown'


class SecureHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains'
        return response
