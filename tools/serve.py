"""Local preview server for Young Sails.

Like `python -m http.server`, but every response says "do not cache", so the
browser always loads the current CSS, JS and JSON after an edit.

    python tools/serve.py            # http://127.0.0.1:8123/
    python tools/serve.py 8125       # another port
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(('127.0.0.1', port), handler) as httpd:
        print(f'Young Sails preview: http://127.0.0.1:{port}/  (Ctrl+C to stop)')
        httpd.serve_forever()


if __name__ == '__main__':
    main()
