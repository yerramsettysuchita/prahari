"""Load backend/.env into the process environment.

Importing this module has the side effect of loading the .env file that sits
next to it. Import it FIRST, before any module that reads environment variables
at import time (escalation_agent, bigquery_sync), so their module-level defaults
pick up the configured values.
"""

from __future__ import annotations

from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).with_name(".env"))
except Exception as exc:  # pragma: no cover - dotenv optional
    print(f"[env] .env not loaded ({exc}); relying on process environment.")
