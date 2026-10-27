import logging
import threading
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from flask import Flask

from api.errors import register_error_handlers
from api.handlers import HANDLERS
from api.jobs import JobStore, JobWorker
from api.routes import analysis
from api.runtime import EngineRuntime
from api.settings import Settings


@dataclass
class Services:
    settings: Settings
    store: JobStore
    runtime: EngineRuntime
    worker: JobWorker


def _default_engine_factory():
    # llama.cpp is imported only here, so the app and its tests can be imported without the model stack.
    from core.service import build_default_service

    return build_default_service()


def _configure_logging() -> None:
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def create_app(
    settings: Settings | None = None,
    *,
    engine_factory: Callable[[], Any] | None = None,
    start_background: bool = True,
) -> Flask:
    settings = settings or Settings.from_env()
    _configure_logging()

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = settings.max_content_length
    register_error_handlers(app)
    app.register_blueprint(analysis)

    runtime = EngineRuntime(engine_factory or _default_engine_factory)
    store = JobStore(max_queued=settings.queue_max, ttl_s=settings.job_ttl_s)
    worker = JobWorker(store, HANDLERS, runtime)
    app.extensions["stabilis"] = Services(settings=settings, store=store, runtime=runtime, worker=worker)

    if start_background:
        threading.Thread(target=runtime.warm, name="stabilis-warmup", daemon=True).start()
        worker.start()
    return app
