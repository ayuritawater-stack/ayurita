"""Shared dependencies: db, jwt, auth, helpers."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import random
import string
import bcrypt
import jwt
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
from fastapi import Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

from security import get_client_ip
from config import rate_limits

# ---------------- Mongo ----------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"


# ---------------- Helpers ----------------
def now_utc():
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def parse_dt(value: Optional[str]) -> Optional[datetime]:
    """Parses an admin-set ISO datetime string (coupon/flash-sale windows) into an aware UTC
    datetime, so it's always safely comparable against now_utc(). These strings come from the
    frontend's `new Date(...).toISOString()`, which is timezone-aware ("Z" suffix) - but a naive
    string is still treated as UTC rather than raising, since older records may predate this."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def new_id() -> str:
    return str(uuid.uuid4())


def gen_order_number() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"AYU-{ts}-{rand}"


# ---------------- Auth ----------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(
    user_id: str,
    email: str,
    role: str = "admin",
    token_version: int = 0,
    expires_delta: Optional[timedelta] = None,
) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "token_version": token_version,
        "exp": now_utc() + (expires_delta or timedelta(hours=12)),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def _fallback_admin(email: str, user_id: str = "fallback-admin") -> dict:
    return {
        "id": user_id,
        "email": email.lower().strip(),
        "name": "Ayurita Admin",
        "role": "admin",
        # The fallback path only ever activates for the env-configured primary account (see
        # admin_login), so it's always the owner, never a staff account.
        "admin_role": "owner",
    }


async def get_current_admin(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access" or payload.get("role") != "admin":
            raise HTTPException(status_code=401, detail="Invalid token")
        try:
            user = await db.admins.find_one({"id": payload["sub"]})
        except Exception:
            return _fallback_admin(payload.get("email", "admin@ayurita.com"), payload.get("sub", "fallback-admin"))
        if not user:
            return _fallback_admin(payload.get("email", "admin@ayurita.com"), payload.get("sub", "fallback-admin"))
        if payload.get("token_version", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Token invalidated")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_owner(admin: dict = Depends(get_current_admin)) -> dict:
    """Gate for owner-only admin routes (pricing, settings, staff management, analytics).
    Admins created before sub-admin roles existed have no `admin_role` field at all - default
    them to "owner" so existing single-admin installs keep full access unchanged."""
    if admin.get("admin_role", "owner") != "owner":
        raise HTTPException(status_code=403, detail="This action requires owner access")
    return admin


async def get_current_customer(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access" or payload.get("role") != "customer":
            raise HTTPException(status_code=401, detail="Invalid token")
        customer = await db.customers.find_one({"id": payload["sub"]})
        if not customer:
            raise HTTPException(status_code=401, detail="Invalid token")
        if payload.get("token_version", 0) != customer.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Token invalidated")
        customer.pop("_id", None)
        customer.pop("password_hash", None)
        return customer
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------- Rate limiting ----------------
# Generic sliding-window limiter. Keyed by an arbitrary string (caller decides whether that's
# an IP, an account id, or both) so it backs all three tiers below instead of duplicating the
# window bookkeeping per tier.
_rate_limit_buckets: Dict[str, list] = defaultdict(list)


def _check_sliding_window(key: str, max_requests: int, window_seconds: int) -> None:
    now = now_utc()
    attempts = [ts for ts in _rate_limit_buckets[key] if (now - ts).total_seconds() <= window_seconds]
    if len(attempts) >= max_requests:
        _rate_limit_buckets[key] = attempts
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    attempts.append(now)
    _rate_limit_buckets[key] = attempts


def check_rate_limit(request: Request, bucket: str, max_requests: int, window_seconds: int) -> None:
    """Per-IP sliding window. Thresholds are passed in by the caller (see the tiered wrappers
    below for the recommended, configurable way to do that) rather than hardcoded here."""
    _check_sliding_window(f"{bucket}:ip:{get_client_ip(request)}", max_requests, window_seconds)


def check_public_rate_limit(request: Request, bucket: str) -> None:
    """Moderate, per-IP limit for unauthenticated but publicly-writable endpoints."""
    max_requests, window_seconds = rate_limits.get_bucket_limit(bucket, rate_limits.PUBLIC_MAX_REQUESTS, rate_limits.PUBLIC_WINDOW_SECONDS)
    check_rate_limit(request, bucket, max_requests, window_seconds)


def check_authenticated_rate_limit(request: Request, bucket: str, identity: str) -> None:
    """Loose, per-account limit for actions by an already-authenticated user. Keyed by account
    id rather than IP - a valid bearer token is itself an abuse barrier."""
    max_requests, window_seconds = rate_limits.get_bucket_limit(bucket, rate_limits.AUTHENTICATED_MAX_REQUESTS, rate_limits.AUTHENTICATED_WINDOW_SECONDS)
    _check_sliding_window(f"{bucket}:account:{identity}", max_requests, window_seconds)


# AUTH tier: login, signup, password change. A flat per-IP ceiling plus exponential backoff
# triggered by failures, tracked independently per-IP *and* per-account, so both a distributed
# attack on one account and repeated attempts against many accounts from one IP are slowed down
# - without a hard lockout that a legitimate user could get stuck behind.
@dataclass
class _AttemptState:
    count: int = 0
    last_attempt: datetime = field(default_factory=now_utc)


_auth_attempts: Dict[str, _AttemptState] = {}


def _auth_backoff_seconds(failure_count: int) -> float:
    if failure_count <= 0:
        return 0.0
    return min(rate_limits.AUTH_BACKOFF_MAX_SECONDS, rate_limits.AUTH_BACKOFF_BASE_SECONDS * (2 ** (failure_count - 1)))


def _check_auth_backoff(key: str) -> None:
    now = now_utc()
    state = _auth_attempts.get(key)
    if not state:
        return
    if (now - state.last_attempt).total_seconds() > rate_limits.AUTH_BACKOFF_RESET_SECONDS:
        _auth_attempts.pop(key, None)
        return
    wait = _auth_backoff_seconds(state.count)
    elapsed = (now - state.last_attempt).total_seconds()
    if elapsed < wait:
        retry_after = max(1, round(wait - elapsed))
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )


def _record_auth_attempt(key: str) -> None:
    now = now_utc()
    state = _auth_attempts.get(key)
    if not state:
        state = _AttemptState(count=0, last_attempt=now)
        _auth_attempts[key] = state
    state.count += 1
    state.last_attempt = now


def _clear_auth_attempts(key: str) -> None:
    _auth_attempts.pop(key, None)


def check_auth_rate_limit(request: Request, bucket: str, account_key: str) -> None:
    """Call before attempting an authentication action (verifying a password, creating an
    account). Raises 429 if the flat per-IP ceiling for `bucket` is exceeded, or if either the
    caller's IP or `account_key` is still within its exponential-backoff cooldown."""
    ip = get_client_ip(request)
    max_requests, window_seconds = rate_limits.get_bucket_limit(bucket, rate_limits.AUTH_IP_MAX_ATTEMPTS, rate_limits.AUTH_IP_WINDOW_SECONDS)
    check_rate_limit(request, bucket, max_requests, window_seconds)
    _check_auth_backoff(f"{bucket}:ip:{ip}")
    _check_auth_backoff(f"{bucket}:account:{account_key}")


def record_auth_failure(request: Request, bucket: str, account_key: str) -> None:
    """Call after an authentication action fails to advance the exponential backoff for both
    the caller's IP and the targeted account."""
    ip = get_client_ip(request)
    _record_auth_attempt(f"{bucket}:ip:{ip}")
    _record_auth_attempt(f"{bucket}:account:{account_key}")


def clear_auth_attempts(request: Request, bucket: str, account_key: str) -> None:
    """Call after an authentication action succeeds to reset the backoff for both keys."""
    ip = get_client_ip(request)
    _clear_auth_attempts(f"{bucket}:ip:{ip}")
    _clear_auth_attempts(f"{bucket}:account:{account_key}")
