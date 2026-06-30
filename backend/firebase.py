"""Firebase Admin initialization, shared across the API and all agents.

Initialization is lazy and tolerant: the app boots even without credentials so
the /health probe always passes on Cloud Run. Firestore-backed endpoints return
503 until credentials are present.

Credential resolution order (Application Default Credentials):
  1. GOOGLE_APPLICATION_CREDENTIALS  -> path to a service-account JSON
  2. Cloud Run's attached service account (automatic in production)
Set FIREBASE_PROJECT_ID and FIREBASE_STORAGE_BUCKET via env on Cloud Run.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import load_env  # noqa: F401  loads backend/.env on import

_db = None
_initialized = False
_init_error = None


def _resolve_credentials_path() -> Optional[str]:
    """Return an absolute path to the service account JSON, or None.

    A relative GOOGLE_APPLICATION_CREDENTIALS is resolved against the backend
    directory (where this file lives), so it works no matter the launch cwd.
    """
    raw = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not raw:
        return None
    p = Path(raw)
    if not p.is_absolute():
        p = (Path(__file__).parent / p).resolve()
    return str(p) if p.exists() else None


def get_init_error():
    """Last Firebase init error message, or None. For diagnostics."""
    if not _initialized:
        _init()
    return _init_error


def _init() -> None:
    global _db, _initialized, _init_error
    if _initialized:
        return
    _initialized = True
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            options = {}
            project_id = os.environ.get("FIREBASE_PROJECT_ID")
            bucket = os.environ.get("FIREBASE_STORAGE_BUCKET")
            if project_id:
                options["projectId"] = project_id
            if bucket:
                options["storageBucket"] = bucket

            cred_path = _resolve_credentials_path()
            if cred_path:
                # Use the service account JSON directly. Robust to launch cwd.
                cred = credentials.Certificate(cred_path)
            else:
                # Cloud Run's attached service account, or ADC in the env.
                cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, options or None)
        _db = firestore.client()
    except Exception as exc:  # pragma: no cover - surfaced via 503 in endpoints
        print(f"[firebase] not initialized: {exc}")
        _init_error = f"{type(exc).__name__}: {exc}"
        _db = None


def get_db():
    """Return a Firestore client, or None if credentials are unavailable."""
    if not _initialized:
        _init()
    return _db


def get_bucket():
    """Return the default Cloud Storage bucket, or None if unavailable."""
    if not _initialized:
        _init()
    try:
        from firebase_admin import storage

        return storage.bucket()
    except Exception as exc:  # pragma: no cover
        print(f"[firebase] storage bucket unavailable: {exc}")
        return None


def upload_image(image_bytes: bytes, path: str, content_type: str = "image/jpeg") -> Optional[str]:
    """Upload bytes to Cloud Storage and return a public URL.

    Returns None if storage is not configured so callers can still create the
    case without an image. Never raises.
    """
    bucket = get_bucket()
    if bucket is None or not image_bytes:
        return None
    try:
        blob = bucket.blob(path)
        blob.upload_from_string(image_bytes, content_type=content_type)
        blob.make_public()
        return blob.public_url
    except Exception as exc:  # pragma: no cover
        print(f"[firebase] image upload failed: {exc}")
        return None
