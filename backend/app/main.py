"""FastAPI application factory with lifespan, CORS, and global error handler."""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import load_settings, parse_allowed_origins
from .db import Database
from .llm_gateway import setup_cache
from .routes import router

# Silence LiteLLM's verbose logs unless DEBUG is set
logging.getLogger("LiteLLM").setLevel(
    logging.DEBUG if os.getenv("DEBUG") else logging.WARNING
)

logger = logging.getLogger(__name__)


def _redact_secrets(text: str, settings: Any) -> str:
    """Replace any configured API key secret in *text* before logging."""
    redacted = text
    if settings is not None:
        for entry in getattr(settings, "api_keys", ()):
            if entry.secret:
                redacted = redacted.replace(entry.secret, f"<{entry.key_id}:redacted>")
    return redacted


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    settings = load_settings()
    db = Database(settings.sqlite_path)
    db.init_schema()
    setup_cache(settings)

    app.state.settings = settings
    app.state.db = db

    logger.info(
        "Lyftr started — %d keys configured, DB at %s",
        len(settings.api_keys),
        settings.sqlite_path,
    )
    yield
    # --- Shutdown (nothing to tear down for SQLite) ---


def create_app() -> FastAPI:
    app = FastAPI(
        title="Lyftr — Resilient LLM Chat Gateway",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url=None,
    )

    # ------------------------------------------------------------------ #
    # CORS — restricted to ALLOWED_ORIGINS from environment              #
    # ------------------------------------------------------------------ #
    allowed_origins = list(
        parse_allowed_origins(os.getenv("ALLOWED_ORIGINS", "http://localhost:3000"))
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------------------------------------------------ #
    # Routes                                                               #
    # ------------------------------------------------------------------ #
    app.include_router(router)

    # ------------------------------------------------------------------ #
    # Exception handlers                                                   #
    # ------------------------------------------------------------------ #

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # exc.errors() may contain Pydantic internals that are not JSON-serializable;
        # convert each error to a plain dict of strings.
        errors = []
        for err in exc.errors():
            errors.append({
                "loc": [str(p) for p in err.get("loc", [])],
                "msg": str(err.get("msg", "")),
                "type": str(err.get("type", "")),
            })
        return JSONResponse(
            status_code=422,
            content={"detail": errors},
        )

    @app.exception_handler(Exception)
    async def catch_all_handler(request: Request, exc: Exception) -> JSONResponse:
        settings = getattr(request.app.state, "settings", None)
        safe_msg = _redact_secrets(f"{type(exc).__name__}: {exc}", settings)
        logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, safe_msg)
        return JSONResponse(
            status_code=500,
            content={"detail": "internal server error"},
        )

    return app


app = create_app()
