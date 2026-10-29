"""Pure Phase 46.10 assertions reused by the mounted production browser journey.

No application state, external network, or browser is accessed by this module.
"""
from urllib.parse import urlsplit

SCREEN_TITLES = {
    'SCR-AIR-001': 'Asset Register',
    'SCR-COR-001': 'Corrosion Loop & Circuit Workspace',
    'SCR-INS-001': 'Inspection Requirements List',
}


def is_unauthorized_api_request(request_url: str, preview_url: str) -> bool:
    """Only same-origin API requests; static assets or external font/CDN URLs are not API access."""
    request = urlsplit(request_url)
    preview = urlsplit(preview_url)
    return (request.scheme == preview.scheme
            and request.netloc == preview.netloc
            and (request.path == '/api' or request.path.startswith('/api/')))
