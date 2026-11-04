from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4

from scripts.family_server import Problem, client_address, create_app, db_connect, local_site, rate_limit


class FamilyTest(unittest.TestCase):
    origin = "https://trio.example"
    password = "Minha frase de teste com espaços"

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.database = Path(temporary.name) / "private" / "families.sqlite3"
        self.app = create_app(database=self.database, origins={self.origin})

    def call(self, method, route, data=None, cookie="", origin=None, status=200):
        raw = json.dumps(data).encode() if data is not None else b""
        env = {"PATH_INFO": "/api/family/" + route, "REQUEST_METHOD": method,
               "HTTP_HOST": "trio.example", "HTTP_ORIGIN": self.origin if origin is None else origin,
               "CONTENT_LENGTH": str(len(raw)), "CONTENT_TYPE": "application/json",
               "wsgi.input": io.BytesIO(raw), "HTTP_COOKIE": cookie, "REMOTE_ADDR": "127.0.0.1"}
        response = {}
        body = json.loads(b"".join(self.app(env, lambda s, h: response.update(status=s, headers=dict(h)))))
        self.assertEqual(int(response["status"][:3]), status, body)
        self.assertEqual(response["headers"]["Cache-Control"], "no-store")
        self.headers = response["headers"]
        return body

    def credentials(self, email):
        return {"email": email, "password": self.password}

    def register(self, email):
        result = self.call("POST", "register", self.credentials(email))
        self.assertEqual(result["parent"]["email"], email.lower())
        self.assertEqual(result["children"], [])
        value = self.headers["Set-Cookie"]
        self.assertTrue(value.startswith("__Host-"))
        for flag in ("Secure", "HttpOnly", "SameSite=Strict", "Path=/"):
            self.assertIn(flag, value)
        return value.partition(";")[0]

    def add_child(self, cookie, name):
        parent_id = self.call("GET", "session", cookie=cookie)["parent"]["id"]
        return self.call("POST", "children", {"parentId": parent_id, "name": name, "avatar": "fox"}, cookie)["child"]["id"]

    @staticmethod
    def attempt(**overrides):
        return {"id": str(uuid4()), "game": "friends", "a": 2, "b": 1, "level": 0,
                "mistakes": 0, "assisted": False, **overrides}

    def test_credentials_session_rotation_revocation_and_expiry(self):
        self.assertIsNone(self.call("GET", "session")["parent"])
        first = self.register("Ana@Example.Org")
        self.call("POST", "login", {"email": "ana@example.org", "password": "senha incorreta"}, status=401)
        self.call("POST", "register", self.credentials("ana@example.org"), status=409)
        child = self.add_child(first, "Léo")
        state = self.call("POST", "login", self.credentials("ana@example.org"), first)
        second = self.headers["Set-Cookie"].partition(";")[0]
        self.assertNotEqual(first, second)
        self.assertEqual(state["children"], [{"id": child, "name": "Léo", "avatar": "fox"}])
        self.assertIsNone(self.call("GET", "session", cookie=first)["parent"])
        with closing(db_connect(self.database)) as db:
            salt, hashed = db.execute("SELECT salt,scrypt_v1 FROM parents").fetchone()
            self.assertEqual(len(salt), 16)
            self.assertNotEqual(hashed, self.password.encode())
            self.assertNotIn(db.execute("SELECT digest FROM sessions").fetchone()[0], second)
        self.call("POST", "logout", {}, second)
        self.assertIsNone(self.call("GET", "session", cookie=second)["parent"])
        self.call("POST", "login", self.credentials("ana@example.org"))
        cookie = self.headers["Set-Cookie"].partition(";")[0]
        with patch("scripts.family_server.time.time", return_value=10_000_000_000):
            self.assertIsNone(self.call("GET", "session", cookie=cookie)["parent"])

    def test_owned_children_progress_and_idempotence_after_restart(self):
        cookie = self.register("pai@example.org")
        child, sibling = self.add_child(cookie, "Léo"), self.add_child(cookie, "Lia")
        attempt_path = f"children/{child}/attempts"
        progress_path = f"children/{child}/progress"
        attempt = self.attempt()
        self.call("POST", attempt_path, attempt, cookie)
        self.call("POST", attempt_path, dict(attempt, mistakes=4), cookie)
        self.call("POST", attempt_path, self.attempt(game="blocks", a=13, b=2, level=3, mistakes=1), cookie)
        self.app = create_app(database=self.database, origins={self.origin})
        result = self.call("GET", progress_path, cookie=cookie)
        self.assertEqual(result["total"], 2)
        self.assertEqual(result["independent"], 1)
        self.assertEqual(result["counts"], {"friends": 1, "blocks": 1})
        self.assertEqual(result["attempts"][0], attempt)
        self.assertEqual(self.call("GET", f"children/{sibling}/progress", cookie=cookie)["total"], 0)
        other = self.register("mae@example.org")
        self.call("GET", progress_path, cookie=other, status=404)
        self.call("POST", attempt_path, self.attempt(), other, status=404)
        self.call("GET", progress_path, status=401)

    def test_stale_parent_form_cannot_add_child_to_another_family(self):
        first = self.register("familia1@example.org")
        stale_id = self.call("GET", "session", cookie=first)["parent"]["id"]
        current = self.register("familia2@example.org")
        fields = {"name": "Lia", "avatar": "cat"}
        self.call("POST", "children", dict(fields, parentId=stale_id), current, status=409)
        self.call("POST", "children", fields, current, status=409)
        for cookie in (first, current):
            self.assertEqual(self.call("GET", "session", cookie=cookie)["children"], [])

    def test_level_windows_remain_ordered_and_counts_cover_all_history(self):
        cookie = self.register("pai@example.org")
        child = self.add_child(cookie, "Léo")
        attempts = [self.attempt(a=4, b=3, level=1, assisted=True)] + [self.attempt() for _ in range(14)]
        for attempt in attempts:
            self.call("POST", f"children/{child}/attempts", attempt, cookie)
        summary = self.call("GET", f"children/{child}/progress", cookie=cookie)
        self.assertEqual(summary["attempts"], [attempts[0]] + attempts[-12:])
        self.assertEqual((summary["total"], summary["independent"]), (15, 14))

    def test_reject_cross_origin_invalid_fields_and_brute_force(self):
        creds = self.credentials("pai@example.org")
        self.call("POST", "register", creds, origin="https://outra.example", status=403)
        self.call("POST", "register", creds, origin="", status=403)
        self.call("POST", "register", dict(creds, password="curta"), status=400)
        cookie = self.register("pai@example.org")
        parent_id = self.call("GET", "session", cookie=cookie)["parent"]["id"]
        self.call("POST", "children", {"parentId": parent_id, "name": "Lia", "avatar": {}}, cookie, status=400)
        child = self.add_child(cookie, "Lia")
        self.call("POST", f"children/{child}/attempts", self.attempt(a=True), cookie, status=400)
        for bad in [self.attempt(a=99, b=0), self.attempt(a=99, b=1), self.attempt(level=2)]:
            self.call("POST", f"children/{child}/attempts", bad, cookie, status=400)
        with patch("scripts.family_server.password_key", return_value=bytes(64)):
            for _ in range(9):
                self.call("POST", "login", creds, status=401)
            self.call("POST", "login", creds, status=429)

    def test_concurrent_budget_and_proxy_spoofing(self):
        def compete(_):
            with closing(db_connect(self.database)) as db:
                try:
                    rate_limit(db, "ana@example.org", "client")
                    return 200
                except Problem as error:
                    return error.status

        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(compete, range(20)))
        self.assertEqual(results.count(200), 10)
        self.assertEqual(results.count(429), 10)
        env = {"REMOTE_ADDR": "127.0.0.1", "HTTP_X_REAL_IP": "203.0.113.1"}
        self.assertEqual(client_address(env, None), "127.0.0.1")
        self.assertEqual(client_address(env, "192.0.2.1"), "127.0.0.1")
        self.assertEqual(client_address(env, "127.0.0.1"), "203.0.113.1")
        env["HTTP_X_REAL_IP"] = "203.0.113.1, 192.0.2.7"
        self.assertEqual(client_address(env, "127.0.0.1"), "127.0.0.1")

    def test_local_site_denies_private_files(self):
        app = local_site(self.app)
        for path in ("/scripts/family_server.py", "/.git/config", "/family.sqlite3", "/../.env"):
            status = []
            response = app({"PATH_INFO": path, "REQUEST_METHOD": "GET"}, lambda s, h: status.append(s))
            self.assertEqual(status, ["404 Not Found"])
            self.assertEqual(response, [])
