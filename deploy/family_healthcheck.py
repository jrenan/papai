"""Probe the WSGI process and its SQLite connection over the container loopback."""

from http.client import HTTPConnection
import json
import os
from urllib.parse import urlsplit

if __name__ == "__main__":
    conn = HTTPConnection("127.0.0.1", 8000, timeout=3)
    try:
        host = urlsplit(os.environ["FAMILY_API_ORIGIN"]).netloc
        conn.request("GET", "/api/family/session", headers={"Host": host})
        response = conn.getresponse()
        if response.status != 200 or json.load(response) != {"parent": None, "children": []}:
            raise SystemExit("A API ainda não está pronta.")
    finally:
        conn.close()
