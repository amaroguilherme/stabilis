"""Job handlers: each receives (service, payload) and returns a JSON-able dict."""

from api.jobs import ServiceUnavailable


def extract(service, payload: dict) -> dict:
    if not hasattr(service, "extract"):
        raise ServiceUnavailable()
    return service.extract(payload["text"], payload["task"])


HANDLERS = {"extract": extract}
