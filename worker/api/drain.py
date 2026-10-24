"""Serverless entry point (Vercel Python runtime): process queued documents.

The web app calls this after each upload, authenticated with a shared secret.
Jobs are claimed with SKIP LOCKED, so overlapping calls are safe.
"""

import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ddc_worker.config import get_settings  # noqa: E402
from ddc_worker.runner import configure_logging, run_once  # noqa: E402


class handler(BaseHTTPRequestHandler):  # noqa: N801 - name required by the runtime
    def do_POST(self):  # noqa: N802
        supplied = self.headers.get("Authorization", "").removeprefix("Bearer ")
        # DDC_DRAIN_SECRET is shared with the web app; CRON_SECRET is sent by Vercel Cron.
        secrets = [os.environ.get(k, "") for k in ("DDC_DRAIN_SECRET", "CRON_SECRET")]
        if not any(s and hmac.compare_digest(s, supplied) for s in secrets):
            self._reply(401, {"error": "unauthorized"})
            return
        settings = get_settings()
        configure_logging(settings.log_level)
        # Leave headroom under the function's 300 second limit.
        processed = run_once(settings, time_budget_seconds=200)
        self._reply(200, {"processed": processed})

    do_GET = do_POST  # Vercel Cron sends GET

    def _reply(self, status: int, body: dict) -> None:
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
