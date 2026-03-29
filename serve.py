import http.server
import os
import sys

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(PROJECT_DIR)
print(f"Serving from {PROJECT_DIR}")

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

port = int(os.environ.get("PORT", sys.argv[1] if len(sys.argv) > 1 else 8080))
print(f"Serving on http://localhost:{port}")
http.server.HTTPServer(("", port), NoCacheHandler).serve_forever()
