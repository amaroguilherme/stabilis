"""Error responses and request logging.

Clients only ever see `{"error": <code>, "request_id": <id>}`. Logs carry the request id, route,
status, duration and exception class — never request bodies or exception messages, which may
contain patient text.
"""

import logging
import time
import traceback
import uuid
from pathlib import Path

from flask import Flask, g, jsonify, request
from werkzeug.exceptions import HTTPException

logger = logging.getLogger("stabilis.api")

_HTTP_CODES = {
    400: "invalid_input",
    404: "not_found",
    405: "method_not_allowed",
    413: "too_large",
    415: "unsupported_media_type",
}


class ApiError(Exception):
    def __init__(self, code: str, status: int = 400, headers: dict[str, str] | None = None):
        super().__init__(code)
        self.code = code
        self.status = status
        self.headers = headers or {}


def error_response(code: str, status: int, headers: dict[str, str] | None = None):
    response = jsonify({"error": code, "request_id": g.get("request_id")})
    response.status_code = status
    response.headers.update(headers or {})
    return response


def _location(exc: BaseException) -> str:
    frames = traceback.extract_tb(exc.__traceback__)
    if not frames:
        return "?"
    return f"{Path(frames[-1].filename).name}:{frames[-1].lineno}"


def register_error_handlers(app: Flask) -> None:
    @app.before_request
    def _start_request():
        g.request_id = uuid.uuid4().hex
        g.started_at = time.perf_counter()

    @app.after_request
    def _log_request(response):
        response.headers["X-Request-ID"] = g.get("request_id", "")
        elapsed_ms = (time.perf_counter() - g.get("started_at", time.perf_counter())) * 1000
        logger.info(
            "request id=%s method=%s path=%s status=%s ms=%.0f",
            g.get("request_id"), request.method, request.path, response.status_code, elapsed_ms,
        )
        return response

    @app.errorhandler(ApiError)
    def _api_error(exc: ApiError):
        return error_response(exc.code, exc.status, exc.headers)

    @app.errorhandler(HTTPException)
    def _http_error(exc: HTTPException):
        return error_response(_HTTP_CODES.get(exc.code, "http_error"), exc.code or 500)

    @app.errorhandler(Exception)
    def _unexpected_error(exc: Exception):
        logger.error("unhandled id=%s error=%s at=%s", g.get("request_id"), type(exc).__name__, _location(exc))
        return error_response("internal", 500)
