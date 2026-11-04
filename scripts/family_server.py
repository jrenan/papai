"""First-party family API. Run directly for local play, or use create_app() in WSGI."""

import argparse
import hashlib
import hmac
import ipaddress
import json
import mimetypes
import os
from pathlib import Path
import re
import secrets
import sqlite3
import subprocess
import time
import uuid
from contextlib import closing
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
from socketserver import ThreadingMixIn
from urllib.parse import urlsplit
from wsgiref.simple_server import WSGIServer, make_server
from wsgiref.util import FileWrapper

ROOT = Path(__file__).resolve().parent.parent
PREFIX = "/api/family/"
SESSION_AGE = 14 * 24 * 3600
AVATARS = {"fox", "bunny", "bear", "cat"}
SCHEMA = """
CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
  salt BLOB NOT NULL, scrypt_v1 BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  digest TEXT PRIMARY KEY, parent TEXT NOT NULL REFERENCES parents(id),
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY, parent TEXT NOT NULL REFERENCES parents(id),
  name TEXT NOT NULL, avatar TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS family_children ON children(parent);
CREATE TABLE IF NOT EXISTS attempts (
  seq INTEGER PRIMARY KEY, child TEXT NOT NULL REFERENCES children(id),
  id TEXT NOT NULL, game TEXT NOT NULL, a INTEGER NOT NULL, b INTEGER NOT NULL,
  level INTEGER NOT NULL, mistakes INTEGER NOT NULL, assisted INTEGER NOT NULL,
  UNIQUE(child, id)
);
CREATE INDEX IF NOT EXISTS child_level_history ON attempts(child, level, seq);
CREATE TABLE IF NOT EXISTS auth_limits (
  key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL
);
"""


class Problem(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def password_key(password, salt):
    return hashlib.scrypt(password.encode(), salt=salt, n=1 << 15, r=8, p=3, maxmem=64 << 20)


def db_connect(path):
    db = sqlite3.connect(str(path), timeout=8)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    return db


def rate_limit(db, email, address):
    # Reserve capacity before hashing. BEGIN IMMEDIATE serializes concurrent workers.
    now = int(time.time())
    with db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM auth_limits WHERE expires <= ?", (now,))
        for key, limit in ((f"ip/{address}", 45), (f"email/{email}", 10)):
            hits = db.execute("""
                INSERT INTO auth_limits VALUES (?, 1, ?)
                ON CONFLICT(key) DO UPDATE SET hits=hits+1
                RETURNING hits
            """, (digest(key), now + 900)).fetchone()[0]
            if hits > limit:
                raise Problem(429, "Muitas tentativas. Tente de novo em 15 minutos.")


def read_body(env):
    if env.get("CONTENT_TYPE", "").partition(";")[0].strip().lower() != "application/json":
        raise Problem(415, "Envie os dados em JSON.")
    try:
        length = int(env.get("CONTENT_LENGTH") or 0)
    except ValueError:
        raise Problem(400, "Tamanho inválido.") from None
    if not 0 < length <= 4096:
        raise Problem(413, "Tamanho de mensagem inválido.")
    try:
        data = json.loads(env["wsgi.input"].read(length).decode("utf-8"))
        # Reject unpaired UTF-16 surrogates before sending user input to scrypt or SQLite.
        json.dumps(data, ensure_ascii=False).encode()
    except (ValueError, RecursionError):
        raise Problem(400, "Dados inválidos.") from None
    if not isinstance(data, dict):
        raise Problem(400, "Dados inválidos.")
    return data


def session_state(db, parent):
    if not parent:
        return {"parent": None, "children": []}
    children = db.execute("SELECT id,name,avatar FROM children WHERE parent=? ORDER BY rowid", (parent["id"],))
    return {"parent": dict(parent), "children": [dict(row) for row in children]}


def authenticate(db, route, data, address, token, cookie_name, secure):
    email, password = data.get("email"), data.get("password")
    if not isinstance(email, str) or not isinstance(password, str):
        raise Problem(400, "Preencha o e-mail e a senha.")
    email = email.strip().lower()
    if len(email) > 254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise Problem(400, "Confira o e-mail informado.")
    if not 1 <= len(password) <= 128 or (route == "register" and len(password) < 15):
        raise Problem(400, "Use uma senha de 15 a 128 caracteres.")
    rate_limit(db, email, address)
    if route == "register":
        parent_id, salt = str(uuid.uuid4()), secrets.token_bytes(16)
        key = password_key(password, salt)
        try:
            db.execute("INSERT INTO parents VALUES (?,?,?,?)", (parent_id, email, salt, key))
        except sqlite3.IntegrityError:
            raise Problem(409, "Não foi possível criar a conta com esse e-mail. Tente entrar.") from None
    else:
        row = db.execute("SELECT id,salt,scrypt_v1 FROM parents WHERE email=?", (email,)).fetchone()
        key = password_key(password, row["salt"] if row else bytes(16))
        if not hmac.compare_digest(key, row["scrypt_v1"] if row else bytes(64)) or not row:
            raise Problem(401, "E-mail ou senha incorretos.")
        parent_id = row["id"]
    now = int(time.time())
    db.execute("DELETE FROM sessions WHERE digest=? OR expires<=?", (digest(token), now))
    fresh = secrets.token_urlsafe(32)
    db.execute("INSERT INTO sessions VALUES (?,?,?)", (digest(fresh), parent_id, now + SESSION_AGE))
    state = session_state(db, {"id": parent_id, "email": email})
    return state, [("Set-Cookie", session_cookie(cookie_name, fresh, SESSION_AGE, secure))]


def session_cookie(name, value, age, secure):
    flags = "; Secure" if secure else ""
    return f"{name}={value}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}{flags}"


def save_attempt(db, child_id, data):
    try:
        attempt_id = str(uuid.UUID(data["id"]))
        if (attempt_id != data["id"] or data["game"] not in ("friends", "blocks")
                or type(data["assisted"]) is not bool):
            raise ValueError
        for field, low, high in (("level", 0, 5), ("mistakes", 0, 99), ("a", 1, 100), ("b", 1, 100)):
            if type(data[field]) is not int or not low <= data[field] <= high:
                raise ValueError
        a, b = data["a"], data["b"]
        # Same skill boundaries as levelOf in soma/journey.js, for free and guided play.
        if data["game"] == "friends":
            if max(a, b) > 10:
                raise ValueError
            expected = 0 if a + b <= 5 else 1 if a + b <= 10 else 2
        else:
            carry = a % 10 + b % 10 >= 10
            if a > 69 or b > 39 or a + b > 100 or (a + b > 50 and not carry):
                raise ValueError
            expected = 3 if a + b <= 20 else 4 if a + b <= 50 and not carry else 5
        if expected != data["level"]:
            raise ValueError
    except (KeyError, TypeError, AttributeError, ValueError):
        raise Problem(400, "Esta rodada contém dados inválidos.") from None
    columns = ("id", "game", "a", "b", "level", "mistakes", "assisted")
    db.execute("""
        INSERT INTO attempts(child,id,game,a,b,level,mistakes,assisted)
        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(child,id) DO NOTHING
    """, (child_id, *(data[name] for name in columns)))
    return {"ok": True}


def progress(db, child_id):
    # Both the history and lifetime counts come from the same read snapshot.
    db.execute("BEGIN")
    totals = dict(db.execute("""
        SELECT count(*) AS total, count(CASE WHEN mistakes=0 AND assisted=0 THEN 1 END) AS independent,
               count(CASE WHEN game='friends' THEN 1 END) AS friends,
               count(CASE WHEN game='blocks' THEN 1 END) AS blocks
          FROM attempts WHERE child=?
    """, (child_id,)).fetchone())
    attempts = []
    for level in range(6):
        attempts.extend(db.execute("""
            SELECT seq,id,game,a,b,level,mistakes,assisted FROM attempts
            WHERE child=? AND level=? ORDER BY seq DESC LIMIT 12
        """, (child_id, level)))
    attempts.sort(key=lambda row: row["seq"])
    history = []
    for row in attempts:
        item = dict(row)
        del item["seq"]
        item["assisted"] = bool(item["assisted"])
        history.append(item)
    return {"total": totals["total"], "independent": totals["independent"],
            "counts": {game: totals[game] for game in ("friends", "blocks")},
            "attempts": history}


def client_address(env, trusted_proxy):
    peer = env.get("REMOTE_ADDR", "")
    if trusted_proxy and peer == trusted_proxy:
        try:
            return str(ipaddress.ip_address(env.get("HTTP_X_REAL_IP", "")))
        except ValueError:
            # A misconfigured proxy shares one bucket until its header is fixed.
            pass
    return peer


def dispatch(db, env, origins, trusted_proxy):
    route = env["PATH_INFO"].removeprefix(PREFIX)
    method = env["REQUEST_METHOD"]
    host = env.get("HTTP_HOST", "")
    origin = next((value for value in origins if urlsplit(value).netloc == host), None)
    if not origin:
        raise Problem(403, "Endereço de acesso inválido.")
    secure = origin.startswith("https://")
    cookie_name = "__Host-trio_family" if secure else "trio_family_dev"
    cookie = SimpleCookie()
    try:
        cookie.load(env.get("HTTP_COOKIE", ""))
    except CookieError:
        pass
    token = cookie[cookie_name].value if cookie_name in cookie else ""
    if method == "POST":
        if env.get("HTTP_ORIGIN") != origin or env.get("HTTP_SEC_FETCH_SITE") == "cross-site":
            raise Problem(403, "Abra o jogo novamente para continuar.")
        data = read_body(env)
        if route in ("register", "login"):
            return authenticate(db, route, data, client_address(env, trusted_proxy), token, cookie_name, secure)
        if route == "logout":
            db.execute("DELETE FROM sessions WHERE digest=?", (digest(token),))
            return {"ok": True}, [("Set-Cookie", session_cookie(cookie_name, "", 0, secure))]
    elif method != "GET":
        raise Problem(405, "Método inválido.")

    parent = db.execute("""
        SELECT p.id,p.email FROM parents p JOIN sessions s ON p.id=s.parent
        WHERE s.digest=? AND s.expires>?
    """, (digest(token), int(time.time()))).fetchone()
    if method == "GET" and route == "session":
        return session_state(db, parent), []
    if not parent:
        raise Problem(401, "Entre na conta da família para continuar.")
    if method == "POST" and route == "children":
        if data.get("parentId") != parent["id"]:
            raise Problem(409, "A conta da família mudou. Abra a área dos pais novamente.")
        name, avatar = data.get("name"), data.get("avatar")
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 32 or not name.strip().isprintable():
            raise Problem(400, "Use um apelido de até 32 caracteres.")
        if not isinstance(avatar, str) or avatar not in AVATARS:
            raise Problem(400, "Escolha um bichinho.")
        child_id = str(uuid.uuid4())
        db.execute("INSERT INTO children VALUES (?,?,?,?)", (child_id, parent["id"], name.strip(), avatar))
        return {"child": {"id": child_id, "name": name.strip(), "avatar": avatar}}, []
    match = re.fullmatch(r"children/([0-9a-f-]{36})/(progress|attempts)", route)
    if match:
        child_id, action = match.groups()
        if not db.execute("SELECT 1 FROM children WHERE parent=? AND id=?", (parent["id"], child_id)).fetchone():
            raise Problem(404, "Perfil não encontrado.")
        if method == "GET" and action == "progress":
            return progress(db, child_id), []
        if method == "POST" and action == "attempts":
            return save_attempt(db, child_id, data), []
    raise Problem(404, "Endereço não encontrado.")


def create_app(*, database=None, origins=None):
    """API-only production entry point. A reverse proxy serves the static package."""
    trusted_proxy = None
    if origins is None:
        if os.environ.get("FAMILY_TRUSTED_PROXY"):
            trusted_proxy = str(ipaddress.ip_address(os.environ["FAMILY_TRUSTED_PROXY"]))
        origin = os.environ["FAMILY_ORIGIN"]
        parsed = urlsplit(origin)
        if parsed.scheme != "https" or origin != f"https://{parsed.netloc}" or not parsed.hostname or parsed.username:
            raise ValueError("FAMILY_ORIGIN deve ser uma origem HTTPS, sem caminho.")
        origins = {origin}
    database = Path(database or os.environ.get("FAMILY_DB") or Path.home() / ".local/share/trio-do-saber/family.sqlite3").resolve()
    if database.is_relative_to(ROOT):
        raise ValueError("Guarde FAMILY_DB fora da pasta pública do projeto.")
    database.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with os.fdopen(os.open(database, os.O_CREAT | os.O_RDWR, 0o600), "rb+") as private_file:
        if os.fstat(private_file.fileno()).st_mode & 0o077:
            raise ValueError("FAMILY_DB deve ter permissões privadas (chmod 600).")
    with closing(db_connect(database)) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript(SCHEMA)

    def application(env, start_response):
        headers = [("Cache-Control", "no-store"), ("Content-Type", "application/json; charset=utf-8"),
                   ("X-Content-Type-Options", "nosniff")]
        try:
            if not env["PATH_INFO"].startswith(PREFIX):
                raise Problem(404, "Endereço não encontrado.")
            with closing(db_connect(database)) as db, db:
                result, extra = dispatch(db, env, origins, trusted_proxy)
            headers.extend(extra)
            status = 200
        except Problem as error:
            result, status = {"error": error.message}, error.status
        except sqlite3.OperationalError:
            result, status = {"error": "Não conseguimos acessar os dados agora. Tente novamente."}, 503
        body = json.dumps(result, ensure_ascii=False).encode()
        start_response(f"{status} {HTTPStatus(status).phrase}", headers + [("Content-Length", str(len(body)))])
        return [body]
    return application


def local_site(api):
    # Serve precisely the Pages allowlist, so private data or tools cannot leak.
    command = "console.log(JSON.stringify(require('./scripts/package-pages.cjs').listRuntimeFiles(process.cwd())))"
    files = set(json.loads(subprocess.check_output(["node", "-e", command], cwd=ROOT)))

    def application(env, start_response):
        path = env["PATH_INFO"]
        if path.startswith(PREFIX):
            return api(env, start_response)
        if path.endswith("/"):
            path += "index.html"
        file = path.lstrip("/")
        if env["REQUEST_METHOD"] not in ("GET", "HEAD") or file not in files:
            start_response("404 Not Found", [("Content-Length", "0")])
            return []
        target = ROOT / file
        start_response("200 OK", [("Content-Type", mimetypes.guess_type(file)[0] or "application/octet-stream"),
                                  ("Content-Length", str(target.stat().st_size))])
        if env["REQUEST_METHOD"] == "HEAD":
            return []
        return FileWrapper(target.open("rb"))
    return application


class LocalServer(ThreadingMixIn, WSGIServer):
    # Browsers open speculative connections while downloading audio and images.
    daemon_threads = True


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    port = args.port
    api = create_app(origins={f"http://localhost:{port}", f"http://127.0.0.1:{port}"})
    with make_server("127.0.0.1", port, local_site(api), server_class=LocalServer) as server:
        print(f"Trio do Saber · http://localhost:{port}", flush=True)
        server.serve_forever()
