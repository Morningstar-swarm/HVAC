#!/usr/bin/env python3
"""
Preview the site exactly as GitHub Pages will serve it.

A Pages *project* site lives at https://<user>.github.io/<repo>/, not at a domain
root, and unknown URLs are answered with the site's own 404.html. This builds the
project with the repo's base path and serves it with those same rules, so what you
see here is what the deployed URL does.

Run:  python3 preview-pages.py [repo-name] [port]
      python3 preview-pages.py            # -> http://localhost:8130/best-comfort-hvac/
"""
from __future__ import annotations

import http.server
import io
import os
import shutil
import subprocess
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = (sys.argv[1] if len(sys.argv) > 1 else "best-comfort-hvac").strip("/")
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8130
PREVIEW = ROOT / ".pages-preview"
OUT = PREVIEW / REPO


def build() -> None:
    if PREVIEW.exists():
        shutil.rmtree(PREVIEW)
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"building for https://<user>.github.io/{REPO}/ ...")
    subprocess.run(
        [sys.executable, str(ROOT / "build.py"), f"--out={OUT}",
         f"--base=/{REPO}", f"--site-url=https://example.github.io/{REPO}"],
        check=True,
    )


class PagesHandler(http.server.SimpleHTTPRequestHandler):
    """Serves PREVIEW/<repo>/ at /<repo>/, with Pages' 404 behaviour."""

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(PREVIEW), **kw)

    def translate_path(self, path: str) -> str:
        path = urllib.parse.unquote(path.split("?", 1)[0].split("#", 1)[0])
        if path in ("/", ""):
            path = f"/{REPO}/"
        if path.endswith("/"):
            path += "index.html"
        return str(PREVIEW / path.lstrip("/"))

    def send_head(self):
        target = self.translate_path(self.path)
        if os.path.isfile(target):
            return super().send_head()
        body = (OUT / "404.html").read_bytes() if (OUT / "404.html").is_file() else b"not found"
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        return io.BytesIO(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("   %s\n" % (fmt % args))


if __name__ == "__main__":
    build()
    print(f"\nserving  http://localhost:{PORT}/{REPO}/   (Ctrl-C to stop)")
    print("unknown paths answer with the site 404, exactly like GitHub Pages\n")
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), PagesHandler).serve_forever()
