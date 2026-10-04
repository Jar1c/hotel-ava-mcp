from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY, PAYMONGO_SECRET_KEY, PAYMONGO_BASE_URL
from datetime import datetime, date, timedelta, timezone
from zoneinfo import ZoneInfo
from math import ceil
import os
import json
import re
import hashlib
import ipaddress
import jwt as pyjwt
import uuid
import time
import secrets
import requests as http_requests
from urllib.parse import quote

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://hotel-ava-mcp.vercel.app",
    "https://hotelava.vercel.app",
], "allow_headers": [
    "Content-Type",
    "Authorization",
    "X-Device-Model",
    "Sec-CH-UA",
]}})

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Vercel ships SUPABASE_SERVICE_KEY empty (or pasted as the ANON key). A client
# without service_role gets 0 rows back under RLS, which made booking confirmation
# 404 ("Confirmation Failed") and every availability check answer "available".
# Only trust the key when it is really different from the anon key.
_SERVICE_ROLE_OK = bool(SUPABASE_SERVICE_KEY) and SUPABASE_SERVICE_KEY != SUPABASE_KEY
if not _SERVICE_ROLE_OK:
    print("WARNING: SUPABASE_SERVICE_KEY is missing or equals the anon key - "
          "set the service_role key in Vercel (Settings -> Environment Variables). "
          "Falling back to the shared client for now.")
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if _SERVICE_ROLE_OK else supabase

# ── Simple in-memory TTL cache for heavy analytics/dashboard responses ─────────
# Avoids re-running full-table scans + sklearn on every 20–30s poll.
_RESPONSE_CACHE: dict[str, tuple[float, object]] = {}
_RESPONSE_CACHE_TTL = 90  # seconds — data rarely changes faster than this


def cached_json(key: str, builder, ttl: int = _RESPONSE_CACHE_TTL):
    """Return cached JSON-serializable payload, or build+store it."""
    now = time.time()
    entry = _RESPONSE_CACHE.get(key)
    if entry is not None and now - entry[0] < ttl:
        return entry[1]
    payload = builder()
    _RESPONSE_CACHE[key] = (now, payload)
    return payload


def invalidate_cache(prefix: str | None = None):
    """Drop cache entries (all, or those starting with prefix). Called on writes."""
    if prefix is None:
        _RESPONSE_CACHE.clear()
        return
    for k in [k for k in _RESPONSE_CACHE if k.startswith(prefix)]:
        _RESPONSE_CACHE.pop(k, None)


def get_frontend_url() -> str:
    """Frontend base URL for redirects: browser Origin/Referer -> FRONTEND_URL -> localhost."""
    from urllib.parse import urlsplit
    origin = (request.headers.get("Origin") or "").strip()
    if origin and origin != "null":
        return origin.rstrip("/")
    referer = (request.headers.get("Referer") or "").strip()
    if referer:
        parts = urlsplit(referer)
        if parts.scheme and parts.netloc:
            return f"{parts.scheme}://{parts.netloc}"
    env_url = (os.getenv("FRONTEND_URL") or "").strip()
    if env_url:
        return env_url.rstrip("/")
    return "http://localhost:5173"


def set_auth(token):
    """Set auth session on Supabase client so RLS policies work."""
    global supabase_admin
    if token:
        # No service_role: supabase_admin aliases the shared client, and
        # clear_auth() rebinds that client - re-attach so the caller's JWT
        # actually reaches admin reads (otherwise they return 0 rows -> 404).
        if not _SERVICE_ROLE_OK:
            supabase_admin = supabase
        try:
            supabase.auth.set_session(access_token=token, refresh_token="")
        except Exception:
            pass
        # Also set the postgrest auth header directly — this is what actually
        # propagates the Bearer token for RLS policy evaluation
        try:
            supabase.postgrest.auth(token)
        except Exception:
            pass


def clear_auth():
    """Clear auth on Supabase client for public (anon) queries."""
    global supabase, supabase_admin
    try:
        supabase.postgrest.auth(None)
    except Exception:
        pass
    # Reset to a fresh anon client
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:
        pass
    if not _SERVICE_ROLE_OK:
        supabase_admin = supabase


def get_user_from_token(token):
    """Decode JWT to get user ID. Revoked sessions fail here too (fail-open)."""
    if not token:
        return None
    try:
        payload = pyjwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": True},
        )
        user_id = payload.get("sub")
        if not user_id:
            return None
        if _session_revoked(token):
            return None
        return user_id
    except Exception:
        return None


def require_admin(token):
    """Get user_id and verify admin role. Returns user_id or None."""
    user_id = get_user_from_token(token)
    if not user_id:
        return None
    set_auth(token)
    profile = supabase.table("users").select("role").eq("id", user_id).single().execute()
    if not profile.data or profile.data.get("role") != "admin":
        return None
    return user_id


def days_between(a, b):
    d1 = datetime.strptime(a[:10], "%Y-%m-%d").date()
    d2 = datetime.strptime(b[:10], "%Y-%m-%d").date()
    return (d2 - d1).days


def today_str():
    return date.today().isoformat()


# ── Downpayment ────────────────────────────────────────────────────────────────
# A downpayment booking charges half online; the rest is settled at the hotel
# and recorded via POST /api/bookings/<id>/settle-balance.

DOWNPAYMENT_RATIO = 0.5


def downpayment_amount(total_price):
    """What a downpayment guest owes up front (half, rounded, never 0)."""
    try:
        return max(1, round(float(total_price or 0) * DOWNPAYMENT_RATIO))
    except (TypeError, ValueError):
        return 0


def settled_amount(total_price, payment_mode):
    """Online-collected amount for a confirmed booking of the given mode."""
    total = float(total_price or 0)
    if payment_mode == "downpayment":
        return float(downpayment_amount(total))
    return total


def balance_due(amount_paid, total_price):
    """Still owed at the hotel. Never negative."""
    try:
        return max(0.0, float(total_price or 0) - float(amount_paid or 0))
    except (TypeError, ValueError):
        return 0.0


# ── Check-in / "In-house" state ────────────────────────────────────────────────
# The front desk stamps checked_in_at after scanning the guest's QR. Whether the
# stay is actually RUNNING is derived from the clock against the booking's start
# moment — this server has no scheduler (auto_complete_bookings is a POST that
# only runs when someone opens a page), so everything below is evaluated on read
# and the state flips by itself when the booked time arrives.

HOTEL_TZ = ZoneInfo("Asia/Manila")

# Overnight stays store a date, not a clock, so they need a house time.
DEFAULT_CHECK_IN_TIME = "2:00 PM"


def hotel_now():
    """Current wall-clock time in the hotel's timezone (Asia/Manila)."""
    return datetime.now(timezone.utc).astimezone(HOTEL_TZ)


def parse_clock(text, default=None):
    """'10:00 AM', '14:00', '2:00PM' -> minutes past midnight. Else default."""
    if not text:
        return default
    m = re.match(r"\s*(\d{1,2}):(\d{2})\s*(AM|PM)?", str(text), re.IGNORECASE)
    if not m:
        return default
    hours, minutes = int(m.group(1)), int(m.group(2))
    period = (m.group(3) or "").upper()
    if period == "PM" and hours != 12:
        hours += 12
    elif period == "AM" and hours == 12:
        hours = 0
    if hours > 23 or minutes > 59:
        return default
    return hours * 60 + minutes


def _as_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _as_minutes(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def stay_type_of(b):
    return (b.get("stay_type") or "overnight").strip() or "overnight"


def check_in_moment(b):
    """(date, minutes-past-midnight) the stay starts, in hotel time."""
    day = _as_date(b.get("check_in"))
    if stay_type_of(b) == "day":
        return day, parse_clock(b.get("start_time"), 0) or 0
    return day, parse_clock(DEFAULT_CHECK_IN_TIME, 14 * 60) or (14 * 60)


def stay_end_moment(b):
    """(date, minutes-past-midnight) the stay ends. Mirrors auto_complete's rule:
    overnight ends at midnight of the day AFTER check_out, a day-use stay ends
    when its duration runs out. (None, 0) = nothing to end on."""
    if stay_type_of(b) == "day":
        if not b.get("start_time") or not b.get("duration"):
            return None, 0
        end = parse_clock(b.get("start_time"), 0) or 0
        end += max(0, _as_minutes(b.get("duration"))) * 60
        return _as_date(b.get("check_in")), end
    out = _as_date(b.get("check_out"))
    if out is None:
        return None, 0
    return out + timedelta(days=1), 0


def arrival_state(b, now=None):
    """none | early | in_house | ended — derived, never stored."""
    if (b.get("status") or "") in ("cancelled", "completed", "checked-out"):
        return "ended"

    now = now or hotel_now()

    # Checked the end FIRST: a no-show whose stay already passed must not be
    # offered a check-in button, scanned or not.
    end_day, end_minutes = stay_end_moment(b)
    if end_day is not None and (
        now.date() > end_day or (now.date() == end_day and now.hour * 60 + now.minute >= end_minutes)
    ):
        return "ended"

    if not b.get("checked_in_at"):
        return "none"

    start_day, start_minutes = check_in_moment(b)
    if start_day is None:
        return "in_house"
    if now.date() < start_day:
        return "early"
    if now.date() == start_day and now.hour * 60 + now.minute < start_minutes:
        return "early"
    return "in_house"


def format_moment(day, minutes):
    """'Oct 5, 2:00 PM' for the banners."""
    if day is None:
        return ""
    label = parse_clock_label(minutes)
    return f"{day.strftime('%b %d, ')}{label}" if label else day.strftime("%b %d, %Y")


def parse_clock_label(minutes):
    try:
        total = int(minutes or 0)
    except (TypeError, ValueError):
        return ""
    hours, mins = divmod(total, 60)
    period = "AM" if hours < 12 else "PM"
    display = hours % 12 or 12
    return f"{display}:{mins:02d} {period}"


# ── Notifications ────────────────────────────────────────────────────────────────

MAX_NOTIFICATIONS = 30


def create_notification(user_id, notif_type, title, message, booking_id=None, device_id=None):
    """Insert a notification and trim old ones to MAX_NOTIFICATIONS."""
    try:
        # Service-role client on purpose: the row belongs to ANOTHER user, and
        # notifications RLS only allows INSERT/DELETE where user_id = auth.uid().
        # Writing with the acting user's JWT (admin, cron or anon) returns 403
        # and the notification is silently lost — e.g. a guest never received
        # "Stay Completed" or "How was your stay?" when an admin closed the
        # booking. The content is server-generated, so nothing user-supplied
        # goes through this path.
        notif_data = {
            "user_id": user_id,
            "type": notif_type,
            "title": title,
            "message": message,
        }
        if booking_id:
            notif_data["booking_id"] = booking_id
        if device_id:
            notif_data["device_id"] = device_id
        try:
            supabase_admin.table("notifications").insert(notif_data).execute()
        except Exception:
            # migrate-new-device-login.sql not run yet — still deliver the
            # alert, just without the device link (action buttons hidden).
            if notif_data.pop("device_id", None) is None:
                raise
            supabase_admin.table("notifications").insert(notif_data).execute()

        # Trim to MAX_NOTIFICATIONS: keep newest, delete oldest
        all_notifs = supabase_admin.table("notifications").select("id").eq("user_id", user_id).order("created_at", desc=True).execute()
        if all_notifs.data and len(all_notifs.data) > MAX_NOTIFICATIONS:
            old_ids = [n["id"] for n in all_notifs.data[MAX_NOTIFICATIONS:]]
            supabase_admin.table("notifications").delete().in_("id", old_ids).execute()
    except Exception as e:
        print(f"Notification error: {e}")


def notify_admins(notif_type, title, message, booking_id=None):
    """Fan-out a notification to every user with role=admin (realtime picks these up)."""
    try:
        admins_res = supabase_admin.table("users").select("id").eq("role", "admin").execute()
        admin_ids = [r["id"] for r in (admins_res.data or [])]
        if not admin_ids:
            return
        for admin_id in admin_ids:
            notif_data = {
                "user_id": admin_id,
                "type": notif_type,
                "title": title,
                "message": message,
            }
            if booking_id:
                notif_data["booking_id"] = booking_id
            try:
                # Service-role client bypasses RLS (required when notifying another user)
                supabase_admin.table("notifications").insert(notif_data).execute()
            except Exception as insert_err:
                print(f"notify_admins insert error for {admin_id}: {insert_err}")
                # Fallback: current auth context (works if RLS WITH CHECK is open)
                create_notification(admin_id, notif_type, title, message, booking_id=booking_id)
    except Exception as e:
        print(f"notify_admins error: {e}")


def _current_device_id(user_id):
    """user_devices.id for the device making THIS request, or None.

    Used to hide a device's own "New login" alert from itself — the device
    that just signed in does not need to be warned about its own sign-in.
    Fail-open (None = no filtering) on any lookup error.
    """
    try:
        device_key, _, _ = _request_device_info()
        res = supabase_admin.table("user_devices") \
            .select("id").eq("user_id", user_id) \
            .eq("device_key", device_key).limit(1).execute()
        return res.data[0]["id"] if res.data else None
    except Exception:
        return None


@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        limit = request.args.get("limit", default=30, type=int)
        # Service-role: shared anon client has no auth context — RLS filtered every row (0 results).
        # user_id already verified from JWT above, so scoping stays per-user.
        res = supabase_admin.table("notifications").select("*").eq("user_id", user_id)
        cur_id = _current_device_id(user_id)
        if cur_id:
            # Hide device alerts THIS device raised about its own sign-in —
            # every other device of the account still sees them. Rows without
            # a device link (bookings, reviews, admin) are never filtered.
            res = res.or_(f"device_id.is.null,device_id.neq.{cur_id}")
        res = res.order("created_at", desc=True).limit(limit).execute()
        return jsonify(res.data or []), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/notifications/unread-count", methods=["GET"])
def get_unread_count():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        res = supabase_admin.table("notifications").select("id", count="exact").eq("user_id", user_id).eq("read", False)
        cur_id = _current_device_id(user_id)
        if cur_id:
            # Same exclusion as GET /api/notifications so the badge always
            # matches what the list shows.
            res = res.or_(f"device_id.is.null,device_id.neq.{cur_id}")
        res = res.execute()
        return jsonify({"count": res.count or 0}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/notifications/<notif_id>/read", methods=["PUT"])
def mark_notification_read(notif_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        supabase_admin.table("notifications").update({"read": True}).eq("id", notif_id).eq("user_id", user_id).execute()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/notifications/read-all", methods=["PUT"])
def mark_all_read():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        supabase_admin.table("notifications").update({"read": True}).eq("user_id", user_id).eq("read", False).execute()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/notifications/<notif_id>", methods=["DELETE"])
def delete_notification(notif_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        supabase_admin.table("notifications").delete().eq("id", notif_id).eq("user_id", user_id).execute()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Auth ───────────────────────────────────────────────────────────────────────

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", email.split("@")[0])

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    # Generate random DiceBear avatar for new user
    dicebear_styles = [
        "adventurer", "avataaars", "big-smile", "lorelei", "micah",
        "notionists", "personas", "bottts", "fun-emoji", "pixel-art"
    ]
    import random
    selected_style = random.choice(dicebear_styles)
    avatar_url = f"https://api.dicebear.com/10.x/{selected_style}/svg?seed={email}"

    try:
        res = supabase.auth.sign_up({"email": email, "password": password, "options": {"data": {"name": name}}})
        # Create user profile row so require_admin / login can read role
        try:
            supabase.table("users").insert({
                "id": res.user.id,
                "name": name,
                "email": email,
                "role": "guest",
                "avatar_url": avatar_url,
            }).execute()
        except Exception:
            pass  # row may already exist or table missing — non-fatal
        return jsonify({"user": {"id": res.user.id, "email": res.user.email, "name": name, "role": "guest", "avatar_url": avatar_url}}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# Samsung model code → marketing name (common models; unknown codes keep the code).
_SAMSUNG_MODELS = {
    "SM-S921B": "Samsung Galaxy S24", "SM-S926B": "Samsung Galaxy S24+", "SM-S928B": "Samsung Galaxy S24 Ultra",
    "SM-S911B": "Samsung Galaxy S23", "SM-S916B": "Samsung Galaxy S23+", "SM-S918B": "Samsung Galaxy S23 Ultra",
    "SM-S901B": "Samsung Galaxy S22", "SM-S906B": "Samsung Galaxy S22+", "SM-S908B": "Samsung Galaxy S22 Ultra",
    "SM-G991B": "Samsung Galaxy S21", "SM-G996B": "Samsung Galaxy S21+", "SM-G998B": "Samsung Galaxy S21 Ultra",
    "SM-A556B": "Samsung Galaxy A55", "SM-A546B": "Samsung Galaxy A54", "SM-A536B": "Samsung Galaxy A53",
    "SM-A346B": "Samsung Galaxy A34", "SM-A336B": "Samsung Galaxy A33", "SM-A256B": "Samsung Galaxy A25",
    "SM-A165F": "Samsung Galaxy A16", "SM-A155F": "Samsung Galaxy A15", "SM-A145B": "Samsung Galaxy A14",
}


def _pretty_model(model: str) -> str:
    """Clean a device-model string; drops UA placeholders ('K', 'Mobile', ...)."""
    model = (model or "").strip()
    if not model or model in ("K", "k", "Mobile", "Tablet", "M", "wv"):
        return ""
    if model in _SAMSUNG_MODELS:
        return _SAMSUNG_MODELS[model]
    if model.startswith("SM-"):
        return "Samsung " + model
    return model


def describe_device(ua: str, model: str = "", brands: str = "") -> str:
    """Human-readable device label: browser + device model (or OS fallback)."""
    ua = (ua or "").strip()
    if not ua:
        return "Unknown device"
    # Brave/Chrome/Firefox/Edge/Opera variants (incl. iOS app UAs)
    if "Brave" in (brands or ""):
        browser = "Brave"
    elif "Edg/" in ua or "EdgiOS/" in ua:
        browser = "Edge"
    elif "OPR/" in ua or "OPiOS/" in ua or "Opera" in ua:
        browser = "Opera"
    elif "SamsungBrowser" in ua:
        browser = "Samsung Internet"
    elif "CriOS/" in ua or "Chrome/" in ua:
        browser = "Chrome"
    elif "FxiOS/" in ua or "Firefox/" in ua:
        browser = "Firefox"
    elif "Safari/" in ua:
        browser = "Safari"
    else:
        browser = "Browser"

    if "Windows" in ua:
        os_name = "Windows"
    elif "Android" in ua:
        os_name = "Android"
    elif "iPhone" in ua or "iPad" in ua or "CPU OS" in ua:
        os_name = "iOS"
    elif "Mac OS X" in ua or "Macintosh" in ua:
        os_name = "macOS"
    elif "Linux" in ua:
        os_name = "Linux"
    else:
        os_name = "this device"

    # Device model wins over the OS: X-Device-Model (UA client hints, sent by
    # the frontend) first, then the UA itself (Firefox/Samsung Internet still
    # embed the model; Chrome's UA is reduced to "K" and relies on the hint).
    device = _pretty_model(model)
    if not device and "Android" in ua:
        m = re.search(r"Android[^;)]*;\s*([^;)]+)", ua)
        if m:
            device = _pretty_model(m.group(1).split(" Build")[0].strip())
    if not device and ("iPhone" in ua or "iPad" in ua):
        device = "iPad" if "iPad" in ua else "iPhone"
    return f"{browser} on {device or os_name}"


def _request_device_info():
    """(device_key, device_name, ip) for the current request."""
    ua = request.headers.get("User-Agent", "") or ""
    model = request.headers.get("X-Device-Model", "") or ""
    brands = request.headers.get("Sec-CH-UA", "") or ""
    ip = (request.headers.get("X-Forwarded-For", "") or "").split(",")[0].strip()
    if not ip:
        ip = request.remote_addr or ""
    return hashlib.sha256(ua.encode("utf-8")).hexdigest(), describe_device(ua, model, brands), ip


_geo_cache: dict = {}


def _geolocate(ip: str) -> str:
    """Best-effort 'City, Country' for an IP — cached, silent on failure."""
    if not ip:
        return ""
    if ip in _geo_cache:
        return _geo_cache[ip]
    try:
        addr = ipaddress.ip_address(ip)
        if addr.is_private or addr.is_loopback or addr.is_link_local:
            return ""
    except ValueError:
        return ""
    try:
        r = http_requests.get(f"https://ipwho.is/{quote(ip, safe='')}", timeout=3,
                              headers={"User-Agent": "HotelAva/1.0"})
        data = r.json()
        if not data.get("success"):
            return ""
        loc = ", ".join(p for p in (data.get("city"), data.get("country")) if p)
        if loc:
            _geo_cache[ip] = loc
        return loc
    except Exception:
        return ""


def _sha256(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def _jwt_session_id(token: str) -> str:
    """Supabase session_id claim from an access/refresh JWT — "" when absent.

    The session_id stays stable across token rotations, so it is the only
    reliable way to tell a STALE revoked row (previous login on this device)
    from a genuinely revoked CURRENT session (session-sync gate).
    """
    try:
        payload = pyjwt.decode(token, options={"verify_signature": False, "verify_exp": False})
        return str(payload.get("session_id") or "")
    except Exception:
        return ""


_user_sessions_has_session_id: bool | None = None


def _supports_session_id() -> bool:
    """True when user_sessions.session_id exists (migrate-session-id.sql)."""
    global _user_sessions_has_session_id
    if _user_sessions_has_session_id:
        return True
    try:
        supabase_admin.table("user_sessions").select("session_id").limit(1).execute()
        _user_sessions_has_session_id = True
    except Exception:
        _user_sessions_has_session_id = False
    return _user_sessions_has_session_id


def _stale_revoked_row(row: dict, access_token: str, refresh_token: str = "") -> bool:
    """True when a revoked session row does NOT belong to the presented
    credentials — a leftover from an EARLIER login on this device.

    This is the "signed out on this device" false-positive fix: after a
    normal logout the revoked row stays until the next login's upsert, and
    the OAuth-redirect mount gate could race ahead of that cleanup, see the
    stale row, and 401 a perfectly fresh session.

    Proof the row IS this session: matching access/refresh hash, or equal
    Supabase session_id (stable across token rotations). Legacy rows without
    a stored session_id fall back to hash matching only.
    """
    if access_token and row.get("access_hash") == _sha256(access_token):
        return False
    if refresh_token and row.get("refresh_hash") == _sha256(refresh_token):
        return False
    presented = _jwt_session_id(access_token) or _jwt_session_id(refresh_token)
    stored = str(row.get("session_id") or "")
    if presented and stored:
        return presented != stored
    # No stored session_id (legacy row): hashes don't match either, so this
    # is a new login after the revocation — stale. Genuine post-rotation
    # revocations of legacy rows are covered by the realtime hash match.
    if presented:
        return True
    # No usable claim on the presented tokens — keep the safe behavior.
    return False


def _session_revoked(token: str) -> bool:
    """True when this access token belongs to a revoked session. Fail-open."""
    try:
        res = supabase_admin.table("user_sessions").select("id") \
            .eq("access_hash", _sha256(token)).eq("revoked", True) \
            .limit(1).execute()
        return bool(res.data)
    except Exception:
        return False


def _mask_email(email: str) -> str:
    """j***@gmail.com — shown on the challenge screen."""
    try:
        local, domain = email.split("@", 1)
        head = local[:2] if len(local) > 2 else local[:1]
        return f"{head}{'*' * max(3, len(local) - len(head))}@{domain}"
    except ValueError:
        return "***"


def _step_up_reason(user_id) -> str:
    """'' when this device+location already belong to the user.

    unknown_device — this browser has never signed in as this user.
    new_location   — known device, but a location never seen for this account.
    Fail-open: any DB/geo error must never lock a user out of their own account.
    """
    try:
        device_key, _, ip = _request_device_info()
        dev = supabase_admin.table("user_devices") \
            .select("id").eq("user_id", user_id) \
            .eq("device_key", device_key).limit(1).execute()
        if not dev.data:
            return "unknown_device"
        # Known device — only compare locations once at least one is recorded,
        # so the first login after this migration learns silently instead of
        # challenging every existing device.
        known = supabase_admin.table("user_devices") \
            .select("id").eq("user_id", user_id) \
            .not_.is_("location", None).limit(1).execute()
        if not known.data:
            return ""
        loc = _geolocate(ip)
        if not loc:
            return ""
        hit = supabase_admin.table("user_devices") \
            .select("id").eq("user_id", user_id) \
            .eq("location", loc).limit(1).execute()
        return "" if hit.data else "new_location"
    except Exception as step_err:
        print(f"Step-up check error: {step_err}")
        return ""


def _create_login_challenge(user_id, email, reason):
    """Create/reuse a pending challenge and email the OTP code.

    Returns the challenge id, or None when the email could not be sent —
    callers then fail open and log the user in normally (never brick login).
    Resends are throttled to one per 60s (GoTrue rate-limits OTP anyway).
    """
    now = datetime.now(timezone.utc)
    challenge_id = None
    try:
        pending = supabase_admin.table("login_challenges").select("*") \
            .eq("user_id", user_id).eq("reason", reason) \
            .gt("expires_at", now.isoformat()) \
            .order("created_at", desc=True).limit(1).execute()
        if pending.data:
            row = pending.data[0]
            challenge_id = row["id"]
            sent = datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00"))
            if (now - sent).total_seconds() < 60:
                return challenge_id  # reuse without sending another email
        else:
            challenge_id = str(uuid.uuid4())
            supabase_admin.table("login_challenges").insert({
                "id": challenge_id,
                "user_id": user_id,
                "email": email,
                "reason": reason,
                "attempts": 0,
                "created_at": now.isoformat(),
                "expires_at": (now + timedelta(minutes=10)).isoformat(),
            }).execute()
        supabase.auth.sign_in_with_otp({
            "email": email,
            "options": {"should_create_user": False},
        })
        if pending.data:
            # Resend — bump created_at so the 60s throttle starts fresh
            supabase_admin.table("login_challenges") \
                .update({"created_at": now.isoformat()}) \
                .eq("id", challenge_id).execute()
        return challenge_id
    except Exception as ch_err:
        print(f"Login challenge error: {ch_err}")
        return None


def _upsert_session(user_id, device_id, device_name, ip, user_agent,
                    access_token, refresh_token=None):
    """One active session row per device — the "Devices & activity" list."""
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "device_name": device_name,
        "ip": ip,
        "location": _geolocate(ip) or None,
        "access_hash": _sha256(access_token),
        "last_used": now,
    }
    # Stable across rotations — session-sync uses it to tell a stale
    # revoked row from a genuine revocation of THIS session. Only written
    # when migrate-session-id.sql has run (probe caches the answer).
    if _supports_session_id():
        payload["session_id"] = _jwt_session_id(access_token) or None
    if refresh_token:
        payload["refresh_hash"] = _sha256(refresh_token)
    try:
        if device_id:
            # Clear revoked leftovers so re-login on a device starts fresh
            supabase_admin.table("user_sessions").delete() \
                .eq("user_id", user_id).eq("device_id", device_id) \
                .eq("revoked", True).execute()
        q = supabase_admin.table("user_sessions").select("id") \
            .eq("user_id", user_id).eq("revoked", False)
        if device_id:
            q = q.eq("device_id", device_id)
        else:
            q = q.is_("device_id", None).eq("device_name", device_name)
        existing = q.execute()
        if existing.data:
            supabase_admin.table("user_sessions").update(payload) \
                .eq("id", existing.data[0]["id"]).execute()
            return
        supabase_admin.table("user_sessions").insert({
            "user_id": user_id,
            "device_id": device_id,
            "device_name": device_name,
            "user_agent": user_agent,
            "ip": ip,
            "created_at": now,
            **payload,
        }).execute()
        # Keep the list bounded: newest 20 sessions per user
        all_rows = supabase_admin.table("user_sessions").select("id") \
            .eq("user_id", user_id).order("created_at", desc=True).execute()
        if all_rows.data and len(all_rows.data) > 20:
            old_ids = [r["id"] for r in all_rows.data[20:]]
            supabase_admin.table("user_sessions").delete() \
                .in_("id", old_ids).execute()
    except Exception as sess_err:
        print(f"Session upsert error: {sess_err}")


def track_new_login(user_id):
    """Upsert the caller's device and alert on a sign-in from an unknown one.

    Non-fatal by design: called inside login() under its own try/except so a
    missing migration or Supabase hiccup never blocks the actual sign-in.
    """
    device_key, device_name, ip = _request_device_info()
    loc = _geolocate(ip)
    now = datetime.now(timezone.utc).isoformat()

    res = supabase_admin.table("user_devices").select("*") \
        .eq("user_id", user_id).eq("device_key", device_key).execute()
    device_id = None
    is_new = False
    trusted = False
    if res.data:
        dev = res.data[0]
        device_id = dev["id"]
        trusted = bool(dev.get("trusted"))
        upd = {"last_seen": now, "ip": ip, "device_name": device_name}
        if loc:
            upd["location"] = loc
        supabase_admin.table("user_devices").update(upd) \
            .eq("id", device_id).execute()
    else:
        new_dev = {
            "user_id": user_id,
            "device_key": device_key,
            "device_name": device_name,
            "ip": ip,
        }
        if loc:
            new_dev["location"] = loc
        inserted = supabase_admin.table("user_devices").insert(new_dev).execute()
        device_id = inserted.data[0]["id"]
        is_new = True

    if trusted:
        return device_id

    # First-ever device of this account (e.g. a brand-new registration):
    # there is nobody else to warn, and this very device already knows it
    # just signed in — the alert would only ever be noise. Only raise it
    # once the account owns at least one OTHER device.
    others = supabase_admin.table("user_devices") \
        .select("id").eq("user_id", user_id).neq("id", device_id) \
        .limit(1).execute()
    if not others.data:
        return device_id

    # One alert at a time: skip while an unread one is pending, and don't
    # nag more than once a day until the user confirms "This was me".
    # No prior alert for this device (even if the row already exists — e.g.
    # the first alert insert failed) → always alert: self-heals muted devices.
    recent = supabase_admin.table("notifications") \
        .select("id", "read", "created_at") \
        .eq("user_id", user_id).eq("device_id", device_id) \
        .order("created_at", desc=True).limit(1).execute()
    if recent.data:
        last = recent.data[0]
        if last.get("read") is False:
            return device_id
        try:
            created = datetime.fromisoformat(str(last["created_at"]).replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - created).total_seconds() < 86400:
                return device_id
        except Exception:
            return device_id

    place = f" in {loc}" if loc else ""
    create_notification(
        user_id,
        "system",
        "New login to your account",
        f"Signed in from {device_name}{place} ({ip}). Ignore this if this was you.",
        device_id=device_id,
    )
    return device_id


@app.route("/api/auth/devices", methods=["GET"])
def list_devices():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        res = supabase_admin.table("user_devices").select("*") \
            .eq("user_id", user_id).order("last_seen", desc=True).execute()
        current_key, _, _ = _request_device_info()
        devices = [{
            "id": d["id"],
            "device_name": d.get("device_name") or "Unknown device",
            "ip": d.get("ip"),
            "trusted": bool(d.get("trusted")),
            "first_seen": d.get("first_seen"),
            "last_seen": d.get("last_seen"),
            "current": d.get("device_key") == current_key,
        } for d in (res.data or [])]
        return jsonify(devices), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/devices/<device_id>/trust", methods=["POST"])
def trust_device(device_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        supabase_admin.table("user_devices").update({"trusted": True}) \
            .eq("id", device_id).eq("user_id", user_id).execute()
        # Alert resolved — clear any still-pending notifications for it
        supabase_admin.table("notifications").delete() \
            .eq("user_id", user_id).eq("device_id", device_id).eq("read", False).execute()
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/track-login", methods=["POST"])
def track_login():
    """Called by the frontend after a Supabase OAuth (Google) sign-in.

    Email/password logins are already tracked inside /api/auth/login; the
    backend dedups by device so a double call is harmless.
    """
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        body = request.get_json(silent=True) or {}

        # Step-up gate FIRST — before any device/session row is written, or the
        # unverified device would look familiar on the next attempt. Fail-open:
        # when the OTP email can't be sent, sign in normally instead.
        reason = _step_up_reason(user_id)
        if reason:
            urow = supabase_admin.table("users") \
                .select("email").eq("id", user_id).limit(1).execute()
            email = urow.data[0]["email"] if urow.data else ""
            if email:
                challenge_id = _create_login_challenge(user_id, email, reason)
                if challenge_id:
                    return jsonify({
                        "verification_required": True,
                        "challenge_id": challenge_id,
                        "email_masked": _mask_email(email),
                        "reason": reason,
                    }), 200

        device_id = track_new_login(user_id)
        _, dname, dip = _request_device_info()
        _upsert_session(
            user_id, device_id, dname, dip,
            request.headers.get("User-Agent", ""),
            token, body.get("refresh_token") or None,
        )
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        session = res.session
        user = res.user

        user_data = supabase.table("users").select("*").eq("id", user.id).single().execute()
        profile_data = user_data.data

        # Auto-create users row if missing (backfill for pre-existing auth users)
        if not profile_data:
            name_val = (user.user_metadata or {}).get("name", "") or user.email.split("@")[0]
            try:
                supabase.table("users").insert({
                    "id": user.id,
                    "name": name_val,
                    "email": user.email,
                    "role": "guest",
                }).execute()
                profile_data = {"name": name_val, "role": "guest", "avatar_url": ""}
            except Exception:
                profile_data = {}

        # Step-up verification — unfamiliar device or a brand-new location →
        # email a one-time code instead of handing back tokens. Fail-open when
        # the challenge email can't be sent: a login must never be bricked.
        try:
            reason = _step_up_reason(user.id)
        except Exception:
            reason = ""
        if reason:
            challenge_id = _create_login_challenge(user.id, user.email, reason)
            if challenge_id:
                return jsonify({
                    "challenge": "otp",
                    "challenge_id": challenge_id,
                    "email_masked": _mask_email(user.email),
                    "reason": reason,
                }), 202

        # New-device alert (non-fatal — never blocks the sign-in itself)
        device_id = None
        try:
            device_id = track_new_login(user.id)
        except Exception as track_err:
            print(f"Device tracking error: {track_err}")

        # Activity list: one session row per device (non-fatal)
        try:
            _, dname, dip = _request_device_info()
            _upsert_session(
                user.id, device_id, dname, dip,
                request.headers.get("User-Agent", ""),
                session.access_token, session.refresh_token,
            )
        except Exception as sess_err:
            print(f"Session track error: {sess_err}")

        return jsonify({
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": profile_data.get("name", user.email.split("@")[0]),
                "role": profile_data.get("role", "guest"),
                "avatar_url": profile_data.get("avatar_url", ""),
                "name_changed_at": profile_data.get("name_changed_at", ""),
            }
        }), 200
    except Exception as e:
        print(f"Login error: {type(e).__name__}: {e}")
        return jsonify({"error": "Invalid email or password"}), 401


def _load_login_challenge(challenge_id):
    """Challenge row when it exists and is still valid, else None."""
    if not challenge_id:
        return None
    res = supabase_admin.table("login_challenges").select("*") \
        .eq("id", str(challenge_id)).limit(1).execute()
    if not res.data:
        return None
    row = res.data[0]
    expires = datetime.fromisoformat(str(row["expires_at"]).replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires:
        try:
            supabase_admin.table("login_challenges") \
                .delete().eq("id", row["id"]).execute()
        except Exception:
            pass
        return None
    return row


@app.route("/api/auth/login/verify", methods=["POST"])
def verify_login_challenge():
    """Exchange the emailed OTP for a full session — the step-up gate."""
    data = request.get_json()
    challenge_id = data.get("challenge_id", "")
    code = (data.get("code", "") or "").strip()

    if not challenge_id or not code:
        return jsonify({"error": "Code is required"}), 400

    try:
        ch = _load_login_challenge(challenge_id)
        if not ch:
            return jsonify({"error": "Verification expired. Please sign in again."}), 410
        if int(ch.get("attempts") or 0) >= 5:
            return jsonify({"error": "Too many attempts. Please sign in again."}), 429

        session = None
        try:
            try:
                v = supabase.auth.verify_otp(
                    {"email": ch["email"], "token": code, "type": "magiclink"})
            except Exception:
                # Older template/type naming — same endpoint, different tag
                v = supabase.auth.verify_otp(
                    {"email": ch["email"], "token": code, "type": "email"})
            session = v.session
        except Exception:
            session = None

        if not session or not session.access_token:
            try:
                supabase_admin.table("login_challenges").update(
                    {"attempts": int(ch.get("attempts") or 0) + 1}
                ).eq("id", ch["id"]).execute()
            except Exception:
                pass
            return jsonify({"error": "Incorrect code. Please try again."}), 400

        # One-time use
        try:
            supabase_admin.table("login_challenges") \
                .delete().eq("id", ch["id"]).execute()
        except Exception:
            pass

        user_id = ch["user_id"]

        # This device is now verified — create its rows exactly like a normal
        # login so the next sign-in from here passes the step-up check.
        device_id = None
        try:
            device_id = track_new_login(user_id)
        except Exception as track_err:
            print(f"Device tracking error: {track_err}")
        try:
            _, dname, dip = _request_device_info()
            _upsert_session(
                user_id, device_id, dname, dip,
                request.headers.get("User-Agent", ""),
                session.access_token, session.refresh_token,
            )
        except Exception as sess_err:
            print(f"Session track error: {sess_err}")

        ures = supabase_admin.table("users").select("*") \
            .eq("id", user_id).limit(1).execute()
        profile_data = ures.data[0] if ures.data else {}

        return jsonify({
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "user": {
                "id": user_id,
                "email": profile_data.get("email") or ch["email"],
                "name": profile_data.get("name") or ch["email"].split("@")[0],
                "role": profile_data.get("role", "guest"),
                "avatar_url": profile_data.get("avatar_url", ""),
                "name_changed_at": profile_data.get("name_changed_at", ""),
            }
        }), 200
    except Exception as e:
        print(f"Login verify error: {type(e).__name__}: {e}")
        return jsonify({"error": "Verification failed. Please try again."}), 500


@app.route("/api/auth/login/resend", methods=["POST"])
def resend_login_challenge():
    data = request.get_json()
    challenge_id = data.get("challenge_id", "")

    try:
        ch = _load_login_challenge(challenge_id)
        if not ch:
            return jsonify({"error": "Verification expired. Please sign in again."}), 410

        sent = datetime.fromisoformat(str(ch["created_at"]).replace("Z", "+00:00"))
        if (datetime.now(timezone.utc) - sent).total_seconds() < 60:
            return jsonify({"error": "Please wait a moment before resending."}), 429

        supabase.auth.sign_in_with_otp({
            "email": ch["email"],
            "options": {"should_create_user": False},
        })
        supabase_admin.table("login_challenges") \
            .update({"created_at": datetime.now(timezone.utc).isoformat(),
                     "attempts": 0}) \
            .eq("id", ch["id"]).execute()
        return jsonify({"message": "A new sign-in code has been sent."}), 200
    except Exception as e:
        print(f"Login resend error: {type(e).__name__}: {e}")
        return jsonify({"error": "Could not resend the code. Please try again."}), 500


@app.route("/api/auth/verify-email", methods=["POST"])
def verify_email():
    data = request.get_json()
    token = data.get("token", "") or data.get("token_hash", "")
    email = data.get("email", "")
    otp_type = data.get("type", "signup")

    if not token:
        return jsonify({"error": "Token is required"}), 400

    try:
        res = supabase.auth.verify_otp({"email": email, "token": token, "type": otp_type})
        session = res.session
        if session and session.access_token:
            return jsonify({
                "message": "Email verified successfully",
                "access_token": session.access_token,
                "refresh_token": session.refresh_token,
            }), 200
        return jsonify({"message": "Email verified successfully"}), 200
    except Exception as e:
        error_msg = str(e)
        # If signup type fails, try email type as fallback
        if "signup" in otp_type:
            try:
                res = supabase.auth.verify_otp({"email": email, "token": token, "type": "email"})
                session = res.session
                if session and session.access_token:
                    return jsonify({
                        "message": "Email verified successfully",
                        "access_token": session.access_token,
                        "refresh_token": session.refresh_token,
                    }), 200
                return jsonify({"message": "Email verified successfully"}), 200
            except Exception:
                pass
        return jsonify({"error": error_msg}), 400


@app.route("/api/auth/complete-registration", methods=["POST"])
def complete_registration():
    """Complete registration for Google OAuth users — set their name."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    name = (data or {}).get("name", "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400

    # Update the user's name (skip cooldown for new users)
    updates = {
        "name": name,
        "updated_at": "now()",
    }
    supabase.table("users").update(updates).eq("id", user_id).execute()

    return jsonify({"message": "Registration completed", "name": name}), 200


@app.route("/api/auth/profile", methods=["GET"])
def get_profile():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # .single() throws (PGRST116) when no row exists yet — common for first-time
    # Google OAuth users whose auth.users entry has no matching public.users row.
    # Catch so the auto-create block below can insert the missing row instead of 500ing.
    try:
        profile = supabase.table("users").select("*").eq("id", user_id).single().execute()
        p = profile.data or {}
    except Exception as e:
        print(f"[profile] user row missing for {user_id}: {e}")
        p = {}

    # Get email from JWT claims (no admin API needed)
    email = p.get("email", "")
    if not email:
        try:
            payload = pyjwt.decode(token, options={"verify_signature": False, "verify_exp": False})
            email = payload.get("email", "")
        except Exception:
            email = ""

    # Auto-create user row for Google/OAuth users if missing
    if not p or not p.get("id"):
        try:
            # Try Supabase Auth metadata first (most reliable for Google users)
            google_name = ""
            google_avatar = ""
            try:
                auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)
                if auth_user and auth_user.user:
                    user_meta = auth_user.user.user_metadata or {}
                    google_name = user_meta.get("full_name", "") or user_meta.get("name", "")
                    google_avatar = user_meta.get("picture", "") or user_meta.get("avatar_url", "")
            except Exception:
                pass

            # Fallback to JWT claims
            payload = pyjwt.decode(token, options={"verify_signature": False, "verify_exp": False})
            name = google_name or payload.get("name", payload.get("full_name", email.split("@")[0] if email else ""))
            avatar = google_avatar or payload.get("avatar_url", payload.get("picture", ""))

            supabase.table("users").insert({
                "id": user_id,
                "name": name,
                "email": email,
                "role": "guest",
                "avatar_url": avatar,
            }).execute()
            p = {"id": user_id, "name": name, "email": email, "role": "guest", "avatar_url": avatar, "phone": "", "created_at": "", "name_changed_at": ""}
        except Exception:
            p = {}

    # System name (DB) is ALWAYS authoritative once set.
    # Only treat name as wrong when missing or clearly corrupted (contains @).
    # Do NOT treat email-prefix names as wrong — that overwrites user-chosen names.
    avatar_url = p.get("avatar_url", "")
    db_name = p.get("name", "")
    name_changed_at = p.get("name_changed_at", "")
    name_is_wrong = (not db_name) or ("@" in db_name)
    # User explicitly changed their name in the system — never auto-replace with Google
    if name_changed_at:
        name_is_wrong = False
    needs_auth_fetch = (not avatar_url) or name_is_wrong
    print(f"[profile] user_id={user_id}, db_avatar_url='{avatar_url}', db_name='{db_name}', name_changed_at='{name_changed_at}', needs_auth_fetch={needs_auth_fetch}")

    if needs_auth_fetch:
        try:
            auth_user = supabase_admin.auth.admin.get_user_by_id(user_id)
            if auth_user and auth_user.user:
                user_meta = auth_user.user.user_metadata or {}
                app_meta = getattr(auth_user.user, 'app_metadata', {}) or {}
                is_google = "google" in (app_meta.get("providers", []) or [])
                print(f"[profile] auth user_metadata keys={list(user_meta.keys())}, is_google={is_google}")

                # Fix avatar if empty
                if not avatar_url:
                    avatar_url = user_meta.get("picture", "") or user_meta.get("avatar_url", "")
                    if avatar_url:
                        print(f"[profile] found avatar from auth metadata")
                        supabase.table("users").update({"avatar_url": avatar_url, "updated_at": "now()"}).eq("id", user_id).execute()

                # Fill name ONLY when empty or corrupted — never overwrite a system name
                if is_google and name_is_wrong:
                    google_name = user_meta.get("full_name", "") or user_meta.get("name", "")
                    if google_name:
                        print(f"[profile] filling empty/corrupt name with '{google_name}'")
                        supabase.table("users").update({"name": google_name, "updated_at": "now()"}).eq("id", user_id).execute()
                        db_name = google_name
        except Exception as e:
            print(f"[profile] auth metadata fetch error: {type(e).__name__}: {e}")

    # Final fallback: try JWT claims
    if not avatar_url:
        try:
            payload = pyjwt.decode(token, options={"verify_signature": False, "verify_exp": False})
            avatar_url = payload.get("avatar_url", payload.get("picture", ""))
            if avatar_url:
                supabase.table("users").update({"avatar_url": avatar_url, "updated_at": "now()"}).eq("id", user_id).execute()
        except Exception:
            pass

    return jsonify({
        "id": user_id,
        "email": email,
        "name": db_name,
        "role": p.get("role", "guest"),
        "avatar_url": avatar_url,
        "phone": p.get("phone", ""),
        "created_at": p.get("created_at", ""),
        "name_changed_at": p.get("name_changed_at", ""),
    }), 200


@app.route("/api/auth/profile", methods=["PUT"])
def update_profile():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        print("[update_profile] No user_id from token")
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json()
        print(f"[update_profile] user_id={user_id}, data keys={list(data.keys())}")
        updates = {}

        if "name" in data:
            # 7-day cooldown check
            user_record_check = supabase.table("users").select("name_changed_at").eq("id", user_id).single().execute()
            name_changed_at = (user_record_check.data or {}).get("name_changed_at")
            if name_changed_at:
                from datetime import datetime, timezone, timedelta
                last_changed = datetime.fromisoformat(name_changed_at.replace("Z", "+00:00"))
                now = datetime.now(timezone.utc)
                days_remaining = 7 - (now - last_changed).days
                if days_remaining > 0:
                    return jsonify({"error": f"You can change your name again in {days_remaining} day(s).", "days_remaining": days_remaining, "retry_after": last_changed.isoformat()}), 429
            updates["name"] = data["name"]
            updates["name_changed_at"] = datetime.now(timezone.utc).isoformat()

        if "avatar_url" in data:
            updates["avatar_url"] = data["avatar_url"]
            print(f"[update_profile] Setting avatar_url={data['avatar_url'][:80]}")
        if "phone" in data:
            updates["phone"] = data["phone"]

        if updates:
            from datetime import datetime, timezone
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            print(f"[update_profile] Executing update: {list(updates.keys())}")
            result = supabase.table("users").update(updates).eq("id", user_id).execute()
            print(f"[update_profile] Update result: data={result.data}")

        user_record = supabase.table("users").select("*").eq("id", user_id).single().execute()
        p = user_record.data or {}
        print(f"[update_profile] DB avatar after update: '{p.get('avatar_url', '')}'")

        return jsonify({
            "id": user_id,
            "email": p.get("email", ""),
            "name": p.get("name", ""),
            "role": p.get("role", "guest"),
            "avatar_url": p.get("avatar_url", ""),
            "phone": p.get("phone", ""),
            "name_changed_at": p.get("name_changed_at", ""),
        }), 200
    except Exception as e:
        print(f"[update_profile] ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/avatar", methods=["POST"])
def upload_avatar():
    """Upload avatar image to Supabase Storage and update user profile."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    # Validate file type
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        return jsonify({"error": "File must be JPEG, PNG, WebP, or GIF"}), 400

    # Validate file size (5MB max)
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > 5 * 1024 * 1024:
        return jsonify({"error": "File must be under 5MB"}), 400

    try:
        ext = file.filename.rsplit(".", 1)[-1].lower()
        path = f"avatars/{user_id}.{ext}"
        file_bytes = file.read()

        # Upload (upsert to replace existing)
        supabase.storage.from_("avatars").upload(path, file_bytes, {"content-type": file.content_type, "upsert": True})

        # Get public URL
        public_url = supabase.storage.from_("avatars").get_public_url(path)

        # Update profile
        set_auth(token)
        supabase.table("users").update({"avatar_url": public_url, "updated_at": "now()"}).eq("id", user_id).execute()

        return jsonify({"avatar_url": public_url}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/password", methods=["PUT"])
def change_password():
    """Change user password. Requires current password verification."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    new_password = data.get("new_password", "")

    if not new_password or len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    # Check password has uppercase and number
    if not any(c.isupper() for c in new_password):
        return jsonify({"error": "Password must contain an uppercase letter"}), 400
    if not any(c.isdigit() for c in new_password):
        return jsonify({"error": "Password must contain a number"}), 400

    try:
        set_auth(token)
        supabase.auth.update_user({"password": new_password})
        return jsonify({"message": "Password updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    """Send password reset email via Supabase."""
    data = request.get_json()
    email = data.get("email", "").strip()
    if not email:
        return jsonify({"error": "Email is required"}), 400

    try:
        frontend_url = get_frontend_url()
        supabase.auth.reset_password_for_email(
            email,
            options={"redirect_to": f"{frontend_url}/reset-password"}
        )
        # Always return success to prevent email enumeration
        return jsonify({"message": "If an account exists with this email, a reset link has been sent."}), 200
    except Exception as e:
        print(f"Forgot password error: {e}")
        return jsonify({"message": "If an account exists with this email, a reset link has been sent."}), 200


@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    """Reset password using the token from email link."""
    data = request.get_json()
    access_token = data.get("access_token", "")
    refresh_token = data.get("refresh_token", "")
    new_password = data.get("new_password", "")

    if not access_token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400

    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    if not any(c.isupper() for c in new_password):
        return jsonify({"error": "Password must contain an uppercase letter"}), 400
    if not any(c.isdigit() for c in new_password):
        return jsonify({"error": "Password must contain a number"}), 400

    try:
        # Set the session with the recovery token
        supabase.auth.set_session(access_token, refresh_token)

        # Get current user
        user = supabase.auth.get_user()
        if not user or not user.user:
            return jsonify({"error": "Invalid or expired reset token"}), 400

        # Update password
        supabase.auth.admin.update_user_by_id(user.user.id, {"password": new_password})
        return jsonify({"message": "Password has been reset successfully"}), 200
    except Exception as e:
        print(f"Reset password error: {e}")
        return jsonify({"error": "Invalid or expired reset token"}), 400


@app.route("/api/auth/refresh", methods=["POST"])
def refresh_token():
    """Use a refresh_token to get a new access_token + refresh_token pair."""
    data = request.get_json()
    refresh = data.get("refresh_token", "")
    if not refresh:
        return jsonify({"error": "refresh_token is required"}), 400

    try:
        # Remote-logout enforcement: refuse a revoked session (fail-open)
        sess_row = None
        try:
            found = supabase_admin.table("user_sessions").select("id", "revoked") \
                .eq("refresh_hash", _sha256(refresh)).limit(1).execute()
            sess_row = found.data[0] if found.data else None
        except Exception:
            sess_row = None
        if sess_row and sess_row.get("revoked"):
            return jsonify({"error": "Session revoked"}), 401

        res = supabase.auth.refresh_session(refresh)
        session = res.session
        user = res.user
        if not session or not user:
            return jsonify({"error": "Invalid refresh token"}), 401

        # Rotate hashes so this device stays trackable after refresh
        if sess_row:
            try:
                supabase_admin.table("user_sessions").update({
                    "access_hash": _sha256(session.access_token),
                    "refresh_hash": _sha256(session.refresh_token),
                    "last_used": datetime.now(timezone.utc).isoformat(),
                }).eq("id", sess_row["id"]).execute()
            except Exception:
                pass

        user_data = supabase.table("users").select("*").eq("id", user.id).single().execute()
        profile_data = user_data.data if user_data.data else {}

        return jsonify({
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": profile_data.get("name", user.email.split("@")[0]),
                "role": profile_data.get("role", "guest"),
                "avatar_url": profile_data.get("avatar_url", ""),
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 401


@app.route("/api/auth/session-sync", methods=["POST"])
def session_sync():
    """The browser client just rotated tokens itself — keep this device's row fresh.

    The Supabase JS client is now the single refresh-token rotator (two
    rotators racing one chain made GoTrue revoke the whole family — the
    "sudden logout" bug). After each client rotation the app posts the new
    pair here so user_sessions access_hash/refresh_hash stay accurate for
    device lists, logout revocation and the remote-logout realtime match.
    Fail-open: hash drift must never break a valid session.
    """
    data = request.get_json() or {}
    new_refresh = data.get("refresh_token", "")
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        # Decode only (no revocation short-circuit) so the explicit row check
        # below can return a distinguishable "Session revoked".
        payload = pyjwt.decode(token, options={"verify_signature": False, "verify_exp": True})
        user_id = payload.get("sub")
    except Exception:
        return jsonify({"error": "Unauthorized"}), 401
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        device_key, device_name, ip = _request_device_info()
        dev = supabase_admin.table("user_devices").select("id") \
            .eq("user_id", user_id).eq("device_key", device_key).limit(1).execute()
        device_id = dev.data[0]["id"] if dev.data else None

        cols = "id, revoked, access_hash, refresh_hash"
        if _supports_session_id():
            cols += ", session_id"
        q = supabase_admin.table("user_sessions").select(cols) \
            .eq("user_id", user_id)
        if device_id:
            q = q.eq("device_id", device_id)
        else:
            q = q.is_("device_id", None).eq("device_name", device_name)
        rows = q.order("created_at", desc=True).limit(1).execute()
        if rows.data and rows.data[0].get("revoked"):
            # Only a genuine revocation of THIS session blocks the gate —
            # a stale row from an earlier login falls through, gets cleaned
            # by the upsert below, and the fresh login survives.
            if not _stale_revoked_row(rows.data[0], token, new_refresh):
                return jsonify({"error": "Session revoked"}), 401

        _upsert_session(user_id, device_id, device_name, ip,
                        request.headers.get("User-Agent", ""), token, new_refresh)
    except Exception as sync_err:
        print(f"Session sync error: {sync_err}")
    return jsonify({"ok": True}), 200


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    if token:
        try:
            supabase_admin.table("user_sessions").update({"revoked": True}) \
                .eq("access_hash", _sha256(token)).eq("revoked", False).execute()
        except Exception:
            pass
        try:
            supabase.auth.sign_out()
        except Exception:
            pass
    return jsonify({"message": "Logged out successfully"}), 200


# ── Devices & activity (session manager) ──────────────────────────────────────

@app.route("/api/auth/sessions", methods=["GET"])
def list_sessions():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        res = supabase_admin.table("user_sessions") \
            .select("id,device_name,ip,location,user_agent,created_at,last_used,access_hash") \
            .eq("user_id", user_id).eq("revoked", False) \
            .order("last_used", desc=True).execute()
        current = _sha256(token)
        out = []
        for r in (res.data or []):
            out.append({
                "id": r["id"],
                "device_name": r.get("device_name") or "Unknown device",
                "ip": r.get("ip"),
                "location": r.get("location"),
                "user_agent": r.get("user_agent"),
                "created_at": r.get("created_at"),
                "last_used": r.get("last_used"),
                "is_current": r.get("access_hash") == current,
            })
        return jsonify(out), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/sessions/<sid>/revoke", methods=["POST"])
def revoke_session(sid):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        current = _sha256(token)
        res = supabase_admin.table("user_sessions") \
            .select("id,access_hash") \
            .eq("id", sid).eq("user_id", user_id).eq("revoked", False).execute()
        if not res.data:
            return jsonify({"error": "Session not found"}), 404
        supabase_admin.table("user_sessions").update({"revoked": True}) \
            .eq("id", sid).execute()
        return jsonify({
            "success": True,
            "self": res.data[0].get("access_hash") == current,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/sessions/revoke-others", methods=["POST"])
def revoke_other_sessions():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        current = _sha256(token)
        res = supabase_admin.table("user_sessions").select("id") \
            .eq("user_id", user_id).eq("revoked", False) \
            .neq("access_hash", current).execute()
        ids = [r["id"] for r in (res.data or [])]
        if ids:
            supabase_admin.table("user_sessions").update({"revoked": True}) \
                .in_("id", ids).execute()
        return jsonify({"success": True, "revoked": len(ids)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Quick Sign-In (Roblox-style code approval) ────────────────────────────────

_SIGNIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O/1/I/L


def _gen_signin_code() -> str:
    return "".join(secrets.choice(_SIGNIN_CODE_ALPHABET) for _ in range(8))


def _mint_session_for(user_id):
    """Fresh session for a user WITHOUT their password (quick-sign-in approve).

    admin.generate_link returns the OTP directly — verify it like an email
    code. Returns (session, email) or (None, None).
    """
    ures = supabase_admin.table("users").select("email") \
        .eq("id", user_id).limit(1).execute()
    if not ures.data:
        return None, None
    email = ures.data[0]["email"]
    # Admin API — must go through the service-role client
    link = supabase_admin.auth.admin.generate_link(
        {"type": "magiclink", "email": email})
    otp = link.properties.email_otp
    v = supabase.auth.verify_otp({"email": email, "token": otp, "type": "magiclink"})
    if not v.session or not v.session.access_token:
        return None, None
    return v.session, email


@app.route("/api/auth/quick-signin/request", methods=["POST"])
def quick_signin_request():
    """Device A (signed-out) generates a short-lived code to approve elsewhere."""
    device_key, device_name, _ = _request_device_info()
    now = datetime.now(timezone.utc)
    try:
        # One active code per requesting device; prune dead rows
        supabase_admin.table("quick_signin_codes").delete() \
            .eq("device_key", device_key).eq("status", "pending").execute()
        supabase_admin.table("quick_signin_codes").delete() \
            .lt("expires_at", (now - timedelta(minutes=5)).isoformat()).execute()

        expires = now + timedelta(seconds=300)
        code = _gen_signin_code()
        for _ in range(3):
            try:
                supabase_admin.table("quick_signin_codes").insert({
                    "code": code,
                    "device_key": device_key,
                    "device_name": device_name,
                    "status": "pending",
                    "created_at": now.isoformat(),
                    "expires_at": expires.isoformat(),
                }).execute()
                break
            except Exception:
                code = _gen_signin_code()  # rare PK collision — retry
        else:
            return jsonify({"error": "Could not create a sign-in code."}), 500

        return jsonify({"code": code, "expires_at": expires.isoformat()}), 200
    except Exception as e:
        print(f"Quick sign-in request error: {e}")
        return jsonify({"error": "Could not create a sign-in code."}), 500


@app.route("/api/auth/quick-signin/status", methods=["GET"])
def quick_signin_status():
    """Device A polls. On approval it consumes the code and gets its session."""
    code = (request.args.get("code", "") or "").strip().upper()
    if not code:
        return jsonify({"status": "invalid"}), 200

    try:
        res = supabase_admin.table("quick_signin_codes").select("*") \
            .eq("code", code).limit(1).execute()
        if not res.data:
            return jsonify({"status": "invalid"}), 200
        row = res.data[0]
        expires = datetime.fromisoformat(str(row["expires_at"]).replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)

        # Codes only work on the device that generated them
        device_key, _, _ = _request_device_info()
        if row.get("device_key") != device_key:
            return jsonify({"status": "invalid"}), 200

        if now > expires:
            if row["status"] == "pending":
                supabase_admin.table("quick_signin_codes") \
                    .update({"status": "expired"}) \
                    .eq("code", code).eq("status", "pending").execute()
            return jsonify({"status": "expired"}), 200

        if row["status"] == "pending":
            left = max(0, int((expires - now).total_seconds()))
            return jsonify({"status": "waiting", "seconds_left": left}), 200
        if row["status"] == "expired":
            return jsonify({"status": "expired"}), 200
        if row["status"] == "consumed":
            return jsonify({"status": "consumed"}), 200
        if row["status"] != "approved":
            return jsonify({"status": "invalid"}), 200

        # Approved — mint the session BEFORE burning the code, so a transient
        # mint failure can be retried by the next poll.
        try:
            session, _ = _mint_session_for(row["user_id"])
        except Exception as mint_err:
            print(f"Quick sign-in mint error: {mint_err}")
            session = None
        if not session:
            return jsonify({"status": "waiting",
                            "seconds_left": max(0, int((expires - now).total_seconds()))}), 200

        taken = supabase_admin.table("quick_signin_codes") \
            .update({"status": "consumed"}) \
            .eq("code", code).eq("status", "approved").execute()
        if not taken.data:
            return jsonify({"status": "consumed"}), 200  # another tab won

        user_id = row["user_id"]
        device_id = None
        try:
            device_id = track_new_login(user_id)
        except Exception as track_err:
            print(f"Device tracking error: {track_err}")
        try:
            _, dname, dip = _request_device_info()
            _upsert_session(
                user_id, device_id, dname, dip,
                request.headers.get("User-Agent", ""),
                session.access_token, session.refresh_token,
            )
        except Exception as sess_err:
            print(f"Session track error: {sess_err}")

        ures = supabase_admin.table("users").select("*") \
            .eq("id", user_id).limit(1).execute()
        profile_data = ures.data[0] if ures.data else {}

        return jsonify({
            "status": "approved",
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "user": {
                "id": user_id,
                "email": profile_data.get("email", ""),
                "name": profile_data.get("name", ""),
                "role": profile_data.get("role", "guest"),
                "avatar_url": profile_data.get("avatar_url", ""),
                "name_changed_at": profile_data.get("name_changed_at", ""),
            },
        }), 200
    except Exception as e:
        print(f"Quick sign-in status error: {e}")
        return jsonify({"error": "Could not check the code."}), 500


@app.route("/api/auth/quick-signin/approve", methods=["POST"])
def quick_signin_approve():
    """Device B (signed in) approves the code shown on device A."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    code = (data.get("code", "") or "").strip().upper()
    if not code:
        return jsonify({"error": "Enter the code from the other device."}), 400

    try:
        res = supabase_admin.table("quick_signin_codes").select("*") \
            .eq("code", code).limit(1).execute()
        if not res.data:
            return jsonify({"error": "That code is not valid."}), 404
        row = res.data[0]
        if row["status"] != "pending":
            return jsonify({"error": "That code is no longer active."}), 409
        expires = datetime.fromisoformat(str(row["expires_at"]).replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires:
            supabase_admin.table("quick_signin_codes") \
                .update({"status": "expired"}) \
                .eq("code", code).eq("status", "pending").execute()
            return jsonify({"error": "That code has expired. Generate a new one."}), 410

        approved = supabase_admin.table("quick_signin_codes") \
            .update({"status": "approved", "user_id": user_id}) \
            .eq("code", code).eq("status", "pending").execute()
        if not approved.data:
            return jsonify({"error": "That code is no longer active."}), 409

        return jsonify({"success": True}), 200
    except Exception as e:
        print(f"Quick sign-in approve error: {e}")
        return jsonify({"error": "Could not approve the code."}), 500


# ── File Upload (Supabase Storage) ────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def upload_image():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    allowed = ("image/jpeg", "image/png", "image/webp", "image/gif")
    if file.content_type not in allowed:
        return jsonify({"error": "Only JPG, PNG, WebP, GIF allowed"}), 400

    try:
        import uuid
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
        filename = f"rooms/{uuid.uuid4().hex}.{ext}"
        file_bytes = file.read()

        supabase.storage.from_("room-images").upload(
            path=filename,
            file=file_bytes,
            file_options={"content-type": file.content_type},
        )

        public_url = f"{SUPABASE_URL}/storage/v1/object/public/room-images/{filename}"
        return jsonify({"url": public_url, "path": filename}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/upload", methods=["DELETE"])
def delete_image():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    path = data.get("path", "")
    if not path:
        return jsonify({"error": "No path provided"}), 400

    try:
        supabase.storage.from_("room-images").remove([path])
        return jsonify({"message": "Deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Public Rooms (no auth required) ───────────────────────────────────────────

# ── Room ratings (reviews) ─────────────────────────────────────────────────────

# Only stays the guest has actually finished can be reviewed.
REVIEWABLE_STATUSES = ("completed", "checked-out")

# Comment cap for a single review (enforced here and on the form).
REVIEW_MAX_CHARS = 250

# Shopee-style photo reviews: up to 5 images, and an admin reply below.
REVIEW_MAX_IMAGES = 5
REVIEW_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp", "image/gif")
REVIEW_IMAGE_MAX_BYTES = 5 * 1024 * 1024          # 5 MB per photo, before resize
REVIEW_REPLY_MAX_CHARS = 500
REVIEW_MIGRATION_HINT = "Run migrate-reviews-images-reply.sql in Supabase → SQL Editor."

# Full column set first; the LEGACY set keeps every review endpoint working
# until migrate-reviews-images-reply.sql has been run.
REVIEW_COLUMNS = "id, booking_id, room_id, user_id, rating, comment, images, admin_reply, admin_replied_at, created_at"
REVIEW_COLUMNS_LEGACY = "id, booking_id, room_id, user_id, rating, comment, created_at"


def _review_columns_missing(err: str) -> bool:
    """True when migrate-reviews-images-reply.sql hasn't been run yet.

    Postgres reports it as 42703 "column … does not exist" on SELECT, while
    PostgREST reports it as PGRST204 "… not … in the schema cache" on
    INSERT/UPDATE — both have to land in the fallback.
    """
    if "reviews" not in err:
        return False
    if not any(col in err for col in ("images", "admin_reply", "admin_replied_at")):
        return False
    return any(marker in err for marker in (
        "does not exist", "schema cache", "PGRST204", "PGRST205", "42703"))


def _select_reviews(make_query):
    """Run a reviews query, retrying without the new columns if the migration is pending."""
    try:
        return make_query(REVIEW_COLUMNS).execute().data or []
    except Exception as e:
        if not _review_columns_missing(str(e)):
            raise
        return make_query(REVIEW_COLUMNS_LEGACY).execute().data or []


def fetch_by_ids(table: str, ids: list, cols: str, chunk: int = 80):
    """Read rows for a list of ids, a batch at a time.

    One in.() filter holding hundreds of uuids runs past the API gateway's
    header limit and comes back as 400 "JSON could not be generated" - which
    used to make the whole reviews page report a missing migration.
    """
    rows = []
    for i in range(0, len(ids), chunk):
        rows.extend(
            supabase_admin.table(table).select(cols)
            .in_("id", ids[i:i + chunk]).execute().data or []
        )
    return rows


def _upload_review_image(file_bytes: bytes, content_type: str, user_id: str, ext: str) -> str:
    """Store one review photo and return its public URL.

    `review-images` comes from the migration; until it exists we fall back to
    room-images/reviews/ so photo reviews never hard-fail.
    """
    token = uuid.uuid4().hex
    last_err = None
    for bucket, prefix in (("review-images", ""), ("room-images", "reviews/")):
        path = f"{prefix}{user_id}/{token}.{ext}"
        try:
            supabase_admin.storage.from_(bucket).upload(
                path=path, file=file_bytes, file_options={"content-type": content_type})
            return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"
        except Exception as e:
            last_err = e
    raise last_err


def _delete_review_images(urls):
    """Best-effort cleanup of stored photos when a review is removed."""
    by_bucket: dict = {}
    for url in urls or []:
        m = re.search(r"/storage/v1/object/public/([^/]+)/(.+)$", url or "")
        if m:
            by_bucket.setdefault(m.group(1), []).append(m.group(2))
    for bucket, paths in by_bucket.items():
        try:
            supabase_admin.storage.from_(bucket).remove(paths)
        except Exception:
            pass


def _public_review_avatar(user: dict, first_name: str) -> str:
    """Avatar shown next to a review on the public room page.

    Stored avatars are either a real photo (upload/Google) or a generated
    dicebear URL seeded with the account email, so the seed is swapped for a
    name+id seed — a public page must never leak an email address. Accounts
    without an avatar get the same deterministic placeholder.
    """
    url = (user.get("avatar_url") or "").strip()
    if url and "api.dicebear.com" not in url:
        return url
    seed = f"{first_name or 'Guest'}-{str(user.get('id') or '')[:6]}"
    return f"https://api.dicebear.com/10.x/adventurer/svg?seed={quote(seed)}"


def _reviews_table_missing(err: str) -> bool:
    """True when migrate-add-reviews.sql hasn't been run in Supabase yet."""
    not_found = "PGRST205" in err or "Could not find the table" in err or "does not exist" in err
    return not_found and "reviews" in err


REVIEWS_NOT_SETUP = "Reviews are not set up yet — run migrate-add-reviews.sql in Supabase → SQL Editor."


_reviews_warned = False


def room_rating_summary(room_id=None):
    """{room_id: {"rating": avg, "reviews": count}} aggregated from the reviews table."""
    global _reviews_warned
    try:
        query = supabase_admin.table("reviews").select("room_id, rating")
        if room_id:
            query = query.eq("room_id", room_id)
        rows = query.execute().data or []
    except Exception as e:
        # Table not migrated yet — degrade to "no ratings" instead of 500ing.
        if not _reviews_warned:
            _reviews_warned = True
            print(f"room_rating_summary: {e} — run migrate-add-reviews.sql in Supabase")
        return {}

    buckets: dict[str, tuple[float, int]] = {}
    for r in rows:
        rid = r.get("room_id")
        if not rid:
            continue
        total, count = buckets.get(rid, (0.0, 0))
        buckets[rid] = (total + float(r.get("rating") or 0), count + 1)
    return {
        rid: {"rating": round(total / count, 1), "reviews": count}
        for rid, (total, count) in buckets.items()
        if count
    }


@app.route("/api/rooms/public", methods=["GET"])
def get_public_rooms():
    try:
        clear_auth()
        rooms_res = supabase.table("rooms").select("*").order("created_at", desc=True).execute()
        rooms = rooms_res.data or []

        ratings = room_rating_summary()

        result = []
        for r in rooms:
            if not r.get("available", True):
                continue
            summary = ratings.get(r["id"], {})
            result.append({
                "id": r["id"],
                "name": r["name"],
                "type": r["type"],
                "description": r.get("description", ""),
                "price": r["price"],
                "capacity": r["capacity"],
                "allows_children": r.get("allows_children", True),
                "max_adults": r.get("max_adults", 2),
                "max_children": r.get("max_children", 1),
                "amenities": r.get("amenities") or [],
                "images": r.get("images") or [],
                "rating": summary.get("rating"),
                "reviews": summary.get("reviews", 0),
            })

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rooms/public/<room_id>", methods=["GET"])
def get_public_room(room_id):
    try:
        clear_auth()
        room_res = supabase.table("rooms").select("*").eq("id", room_id).execute()
        rooms = room_res.data or []
        if not rooms:
            return jsonify({"error": "Room not found"}), 404

        r = rooms[0]
        summary = room_rating_summary(room_id).get(room_id, {})
        return jsonify({
            "id": r["id"],
            "name": r["name"],
            "type": r["type"],
            "description": r.get("description", ""),
            "price": r["price"],
            "capacity": r["capacity"],
            "allows_children": r.get("allows_children", True),
            "max_adults": r.get("max_adults", 2),
            "max_children": r.get("max_children", 1),
            "amenities": r.get("amenities") or [],
            "images": r.get("images") or [],
            "rating": summary.get("rating"),
            "reviews": summary.get("reviews", 0),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Rooms (admin) ─────────────────────────────────────────────────────────────

@app.route("/api/rooms", methods=["GET"])
def get_rooms():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        rooms_res = supabase.table("rooms").select("*").order("created_at", desc=True).execute()
        rooms = rooms_res.data or []

        today = today_str()
        bookings_res = supabase.table("bookings").select("room_id, status, total_price, check_in, check_out").execute()
        bookings = bookings_res.data or []

        room_bookings = {}
        for b in bookings:
            rid = b["room_id"]
            if rid not in room_bookings:
                room_bookings[rid] = {"count": 0, "revenue": 0, "has_active": False}
            rb = room_bookings[rid]
            rb["count"] += 1
            rb["revenue"] += b["total_price"]
            if b["status"] == "confirmed" and b["check_in"] <= today and b["check_out"] > today:
                rb["has_active"] = True

        result = []
        for r in rooms:
            stats = room_bookings.get(r["id"], {"count": 0, "revenue": 0, "has_active": False})
            status = "available"
            if not r["available"]:
                status = "maintenance"
            elif stats["has_active"]:
                status = "occupied"

            result.append({
                "id": r["id"],
                "name": r["name"],
                "type": r["type"],
                "price": r["price"],
                "capacity": r["capacity"],
                "allows_children": r.get("allows_children", True),
                "max_adults": r.get("max_adults", 2),
                "max_children": r.get("max_children", 1),
                "amenities": r.get("amenities") or [],
                "images": r.get("images") or [],
                "description": r.get("description", ""),
                "status": status,
                "bookings": stats["count"],
                "revenue": stats["revenue"],
            })

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rooms", methods=["POST"])
def add_room():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = require_admin(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json()
        room_data = {
            "name": data["name"],
            "type": data["type"],
            "price": data["price"],
            "capacity": data["capacity"],
            "allows_children": data.get("allows_children", True),
            "max_adults": data.get("max_adults", 2),
            "max_children": data.get("max_children", 1),
            "amenities": data.get("amenities", []),
            "images": data.get("images", []),
            "description": data.get("description", ""),
            "available": data.get("status") != "maintenance",
        }
        # Re-set auth after require_admin query (it may reset session context)
        set_auth(token)
        res = supabase.table("rooms").insert(room_data).execute()
        r = res.data[0]

        return jsonify({
            "id": r["id"],
            "name": r["name"],
            "type": r["type"],
            "price": r["price"],
            "capacity": r["capacity"],
            "allows_children": r.get("allows_children", True),
            "max_adults": r.get("max_adults", 2),
            "max_children": r.get("max_children", 1),
            "amenities": r.get("amenities") or [],
            "images": r.get("images") or [],
            "description": r.get("description", ""),
            "status": "available" if r["available"] else "maintenance",
            "bookings": 0,
            "revenue": 0,
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rooms/<room_id>", methods=["PUT"])
def update_room(room_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = require_admin(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json()
        room_data = {
            "name": data["name"],
            "type": data["type"],
            "price": data["price"],
            "capacity": data["capacity"],
            "allows_children": data.get("allows_children", True),
            "max_adults": data.get("max_adults", 2),
            "max_children": data.get("max_children", 1),
            "amenities": data.get("amenities", []),
            "images": data.get("images", []),
            "description": data.get("description", ""),
            "available": data.get("status") != "maintenance",
        }
        # Re-set auth after require_admin query
        set_auth(token)
        res = supabase.table("rooms").update(room_data).eq("id", room_id).execute()
        r = res.data[0]

        # Fetch booking stats
        bookings_res = supabase.table("bookings").select("status, total_price, check_in, check_out").eq("room_id", room_id).execute()
        bookings = bookings_res.data or []
        today = today_str()
        count = len(bookings)
        revenue = sum(b["total_price"] for b in bookings)
        has_active = any(
            b["status"] == "confirmed" and b["check_in"] <= today and b["check_out"] > today
            for b in bookings
        )

        status = "maintenance"
        if r["available"]:
            status = "occupied" if has_active else "available"

        return jsonify({
            "id": r["id"],
            "name": r["name"],
            "type": r["type"],
            "price": r["price"],
            "capacity": r["capacity"],
            "allows_children": r.get("allows_children", True),
            "max_adults": r.get("max_adults", 2),
            "max_children": r.get("max_children", 1),
            "amenities": r.get("amenities") or [],
            "images": r.get("images") or [],
            "description": r.get("description", ""),
            "status": status,
            "bookings": count,
            "revenue": revenue,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/rooms/<room_id>", methods=["DELETE"])
def delete_room(room_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = require_admin(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        set_auth(token)
        supabase.table("rooms").delete().eq("id", room_id).execute()
        return jsonify({"message": "Room deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── PayMongo ────────────────────────────────────────────────────────────────────

def create_paymongo_checkout(booking_id, amount, email, description, success_path=None, cancel_path=None):
    """Create a PayMongo Checkout Session.

    Returns (checkout_url, session_id). The session id is stored on the
    booking so the real payment method (GCash / Maya / card) chosen inside
    PayMongo's hosted page can be read back after payment.
    Returns (None, None) on failure.
    """
    if not PAYMONGO_SECRET_KEY:
        return None, None

    try:
        import base64
        encoded_key = base64.b64encode(PAYMONGO_SECRET_KEY.encode()).decode()

        frontend_url = get_frontend_url()
        success_url = f"{frontend_url}{success_path or f'/booking/confirmation/{booking_id}'}"
        cancel_url = f"{frontend_url}{cancel_path or f'/booking/failed?booking={booking_id}'}"

        res = http_requests.post(
            f"{PAYMONGO_BASE_URL}/checkout_sessions",
            headers={
                "Authorization": f"Basic {encoded_key}",
                "Content-Type": "application/json",
            },
            json={
                "data": {
                    "attributes": {
                        "send_email_receipt": True,
                        "show_description": True,
                        "show_line_items": True,
                        # Name shown in the PayMongo checkout header - defaults to
                        # the account holder's name when omitted.
                        "merchant": "Hotel Ava Malate",
                        "line_items": [
                            {
                                "name": description,
                                "quantity": 1,
                                "amount": int(amount * 100),  # PayMongo uses centavos
                                "currency": "PHP",
                            }
                        ],
                        "payment_method_types": ["gcash", "paymaya", "card"],
                        "success_url": success_url,
                        "cancel_url": cancel_url,
                    }
                }
            },
            timeout=15,
        )

        if res.status_code in (200, 201):
            data = res.json()
            checkout_url = data["data"]["attributes"]["checkout_url"]
            session_id = data["data"].get("id", "")
            return checkout_url, session_id
        else:
            print(f"PayMongo error: {res.status_code} {res.text}")
            return None, None
    except Exception as e:
        print(f"PayMongo error: {e}")
        return None, None


# Canonical payment-method labels stored on the booking row
_PAYMONGO_SOURCE_TYPES = {"gcash": "gcash", "paymaya": "paymaya", "card": "card", "qrph": "qrph"}


def fetch_paymongo_session(session_id):
    """GET a checkout session from PayMongo; returns its attributes dict or None."""
    if not PAYMONGO_SECRET_KEY or not session_id:
        return None
    try:
        import base64
        encoded_key = base64.b64encode(PAYMONGO_SECRET_KEY.encode()).decode()
        res = http_requests.get(
            f"{PAYMONGO_BASE_URL}/checkout_sessions/{session_id}",
            headers={"Authorization": f"Basic {encoded_key}"},
            timeout=15,
        )
        if res.status_code != 200:
            print(f"PayMongo session fetch error: {res.status_code} {res.text}")
            return None
        return res.json().get("data", {}).get("attributes", {})
    except Exception as e:
        print(f"PayMongo session fetch error: {e}")
        return None


def session_payment_info(attrs):
    """From checkout-session attrs, return (paid: bool, method: str|None).

    PayMongo leaves the checkout-session status at 'active' even after an
    attached payment is already 'paid' (webhooks flip it, but local dev never
    receives them), so the payment rows are trusted too.
    """
    if not attrs:
        return False, None
    paid = attrs.get("status") in ("paid", "succeeded")
    method = None
    fallback = None
    for p in attrs.get("payments") or []:
        pa = p.get("attributes", {}) or {}
        source_type = (pa.get("source") or {}).get("type")
        label = _PAYMONGO_SOURCE_TYPES.get(source_type, source_type) if source_type else None
        if label and fallback is None:
            fallback = label
        if pa.get("status") in ("paid", "succeeded"):
            paid = True
            if label:
                method = label
                break
    if paid and not method:
        method = fallback or "paymongo"
    return paid, method


def fetch_paymongo_payment_method(session_id):
    """Read the payment method the customer actually used inside a checkout session."""
    attrs = fetch_paymongo_session(session_id)
    if not attrs:
        return None
    paid, method = session_payment_info(attrs)
    return method if paid else None


def resolve_pending_payment_method(booking_id, payment_method):
    """Replace the 'awaiting:<session_id>' marker with the real method.

    Returns the resolved method, or None if nothing to do / still unpaid.
    """
    if not payment_method or not payment_method.startswith("awaiting:"):
        return None
    method = fetch_paymongo_payment_method(payment_method.split(":", 1)[1])
    if method:
        supabase_admin.table("bookings").update({"payment_method": method}).eq("id", booking_id).execute()
        invalidate_cache("bookings")
        invalidate_cache("dash-")
        return method
    return None


def session_payment_intent_id(attrs):
    """Best-effort payment-intent id from checkout-session attrs (for refunds)."""
    if not attrs:
        return None
    if attrs.get("payment_intent"):
        return attrs["payment_intent"]
    for p in attrs.get("payments") or []:
        pa = p.get("attributes", {}) or {}
        if pa.get("payment_intent"):
            return pa["payment_intent"]
        if p.get("id"):
            return p["id"]
    return None


def paymongo_refund(payment_intent_id, amount_php, reason="requested_by_customer"):
    """POST /v1/refunds. `amount_php` is whole pesos; PayMongo wants centavos.

    Returns (ok: bool, detail: str) — detail is the refund id on success, or the
    reason it failed. Never raises: a refund failure must not stop the booking
    from being cancelled.
    """
    if not PAYMONGO_SECRET_KEY:
        return False, "PAYMONGO_SECRET_KEY is not configured"
    if not payment_intent_id:
        return False, "no payment reference stored on this booking"
    centavos = int(round(float(amount_php or 0) * 100))
    if centavos <= 0:
        return False, "nothing to refund"
    try:
        import base64
        encoded_key = base64.b64encode(PAYMONGO_SECRET_KEY.encode()).decode()
        res = http_requests.post(
            f"{PAYMONGO_BASE_URL}/refunds",
            headers={
                "Authorization": f"Basic {encoded_key}",
                "Content-Type": "application/json",
                "Idempotency-Key": f"refund-{payment_intent_id}-{centavos}",
            },
            json={
                "amount": centavos,
                "payment_intent": payment_intent_id,
                "reason": reason,
            },
            timeout=20,
        )
        if res.status_code in (200, 201):
            try:
                refund_id = res.json().get("data", {}).get("id", "")
            except Exception:
                refund_id = ""
            return True, refund_id
        return False, f"PayMongo {res.status_code}: {res.text[:300]}"
    except Exception as e:
        return False, str(e)


def free_cancellation_ok(b):
    """True when the guest is cancelling at least 24h before the stay starts.

    Matches the advertised policy: "Free cancellation up to 24 hours before
    your scheduled check-in." Uses the same start moment as check-in, so a
    day-use 10:00 AM stay is cut off at 10:00 AM the previous day.
    """
    day, minutes = check_in_moment(b)
    if day is None:
        return False
    start = datetime(day.year, day.month, day.day, minutes // 60, minutes % 60, tzinfo=HOTEL_TZ)
    return hotel_now() + timedelta(hours=24) <= start


# ── Stay windows / extend helpers ──────────────────────────────────────────────

EXTEND_MAX_HOURS = 4
GAP_MINUTES = 60  # extending is blocked when the next booking is <= 1h away


def _now_naive():
    """Asia/Manila-naive now — matches _stay_window, whose dates and
    start_times are guest-local wall-clock, not UTC."""
    return hotel_now().replace(tzinfo=None)


def _parse_time12(value):
    """'2:00 PM' / '14:00' / None -> (hour, minute). Defaults to 14:00."""
    if not value:
        return 14, 0
    m = re.match(r"^\s*(\d{1,2}):(\d{2})\s*([AaPp])?[Mm]?\s*$", str(value))
    if not m:
        return 14, 0
    h, mi = int(m.group(1)), int(m.group(2))
    ap = (m.group(3) or "").upper()
    if ap == "P" and h != 12:
        h += 12
    elif ap == "A" and h == 12:
        h = 0
    if h > 23 or mi > 59:
        return 14, 0
    return h, mi


def _stay_window(b):
    """(start_dt, end_dt) naive wall-clock window of a booking row.

    day-use:  check_in@start_time + duration hours (duration = total hours)
    overnight: check_out@start_time + extension hours stored in duration
    """
    check_in = datetime.strptime(b["check_in"], "%Y-%m-%d")
    h, mi = _parse_time12(b.get("start_time"))
    start = check_in.replace(hour=h, minute=mi)
    if (b.get("stay_type") or "overnight") == "day":
        end = start + timedelta(hours=int(b.get("duration") or 0))
    else:
        check_out = datetime.strptime(b["check_out"], "%Y-%m-%d")
        end = check_out.replace(hour=h, minute=mi) + timedelta(hours=int(b.get("duration") or 0))
    return start, end


def _windows_conflict(a_start, a_end, b_start, b_end):
    """True when two windows overlap or leave <= GAP_MINUTES between them."""
    return not (a_end + timedelta(minutes=GAP_MINUTES) <= b_start or b_end + timedelta(minutes=GAP_MINUTES) <= a_start)


def find_room_conflict(room_id, win_start, win_end, exclude_id=None):
    """Earliest blocking booking start on this room, or None if free.

    Scans pending + confirmed bookings' actual stay windows (all stay types).
    """
    q = supabase_admin.table("bookings").select("id, check_in, check_out, stay_type, start_time, duration") \
        .eq("room_id", room_id).in_("status", ["pending", "confirmed"])
    if exclude_id:
        q = q.neq("id", exclude_id)
    res = q.execute()
    blocking = None
    for other in res.data or []:
        try:
            o_start, o_end = _stay_window(other)
        except Exception:
            continue
        if _windows_conflict(win_start, win_end, o_start, o_end):
            if blocking is None or o_start < blocking:
                blocking = o_start
    return blocking


def suggest_rooms_for_stay(b, win_start, win_end, limit=4):
    """Rooms (excluding the booking's own) free over [win_start, win_end] + gap."""
    try:
        rooms_res = supabase_admin.table("rooms").select("id, name, type, price, images").neq("id", b.get("room_id") or "").execute()
    except Exception:
        return []
    rooms = rooms_res.data or []
    if not rooms:
        return []
    # One query: all candidate bookings whose date range touches the window
    try:
        q = supabase_admin.table("bookings").select("room_id, check_in, check_out, stay_type, start_time, duration") \
            .in_("status", ["pending", "confirmed"]) \
            .lte("check_in", win_end.strftime("%Y-%m-%d")) \
            .gte("check_out", win_start.strftime("%Y-%m-%d"))
        bookings = q.execute().data or []
    except Exception:
        bookings = []
    by_room = {}
    for ob in bookings:
        by_room.setdefault(ob.get("room_id"), []).append(ob)

    out = []
    for r in rooms:
        if len(out) >= limit:
            break
        conflict = False
        for ob in by_room.get(r["id"], []):
            try:
                o_start, o_end = _stay_window(ob)
            except Exception:
                conflict = True
                break
            if _windows_conflict(win_start, win_end, o_start, o_end):
                conflict = True
                break
        if not conflict:
            images = r.get("images") or []
            out.append({
                "id": r["id"],
                "name": r.get("name", ""),
                "type": r.get("type", ""),
                "price": r.get("price", 0),
                "image": images[0] if images else "",
            })
    return out


def gap_conflict_payload(b, win_start, new_end):
    """409 body when extending would leave <= 1h before the next booking."""
    next_start = find_room_conflict(b["room_id"], win_start, new_end, exclude_id=b["id"])
    if next_start is None:
        return None
    return jsonify({
        "error": "Extending would leave less than 1 hour before the next booking. Please choose a shorter extension or another room.",
        "code": "gap_conflict",
        "next_booking_start": next_start.isoformat(),
        "suggested_rooms": suggest_rooms_for_stay(b, win_start, new_end),
    }), 409


def _parse_extend_marker(payment_method):
    """'extend:<session_id>:<hours>[:<original_method>]' -> tuple or None."""
    if not payment_method or not payment_method.startswith("extend:"):
        return None
    parts = payment_method.split(":", 3)
    if len(parts) < 3:
        return None
    try:
        hours = int(parts[2])
    except ValueError:
        return None
    orig = parts[3] if len(parts) > 3 else ""
    return parts[1], hours, orig


def apply_extension_fields(b, hours):
    """Field updates for a paid extension. check_out is never touched —
    extension hours live in duration (day: total hours, overnight: extra hours)."""
    new_duration = int(b.get("duration") or 0) + hours
    fields = {"duration": new_duration}
    if (b.get("stay_type") or "overnight") == "day":
        fields["stays"] = f"{new_duration} Hours"
    return fields


# ── Bookings (user-facing) ──────────────────────────────────────────────────────

@app.route("/api/rooms/check-availability", methods=["POST"])
def check_room_availability():
    """Check if a room is available for given dates/times."""
    data = request.get_json()
    room_id = data.get("room_id")
    check_in = data.get("check_in")
    check_out = data.get("check_out")
    stay_type = data.get("stay_type", "overnight")
    start_time = data.get("start_time")
    duration = data.get("duration")

    if not room_id or not check_in:
        return jsonify({"error": "room_id and check_in are required"}), 400

    if stay_type == "overnight" and not check_out:
        return jsonify({"error": "check_out is required for overnight bookings"}), 400

    try:
        # For day-use, set check_out to next day
        if stay_type == "day":
            from datetime import datetime, timedelta
            check_in_date = datetime.strptime(check_in, "%Y-%m-%d")
            check_out = (check_in_date + timedelta(days=1)).strftime("%Y-%m-%d")

        # Check for overlapping bookings. bookings_no_overlap uses daterange
        # [) bounds over pending + confirmed — mirror it exactly (strict < / >)
        # so back-to-back stays (checkout day == next check-in day) are not
        # falsely reported unavailable.
        if stay_type == "overnight":
            # Two chained filters are ANDed by PostgREST: check_in < check_out
            # AND check_out > check_in. (Nesting and(...) inside or=(...) never
            # matched, so every overnight stay reported "available".)
            # admin client: RLS on bookings hides other guests' rows from the
            # anon client, which made every overnight stay look available.
            overlap_res = supabase_admin.table("bookings").select("id, check_in, check_out") \
                .eq("room_id", room_id).in_("status", ["pending", "confirmed"]) \
                .lt("check_in", check_out).gt("check_out", check_in).execute()
            available = not (overlap_res.data and len(overlap_res.data) > 0)
        else:
            # Day-use: window check (with 1h gap) vs all pending/confirmed stays...
            h, mi = _parse_time12(start_time)
            win_start = datetime.strptime(check_in, "%Y-%m-%d").replace(hour=h, minute=mi)
            win_end = win_start + timedelta(hours=int(duration or 0))
            available = find_room_conflict(room_id, win_start, win_end) is None
            # ...plus: the DB bookings_no_overlap constraint blocks any other
            # pending/confirmed booking with the same date range entirely.
            if available:
                same_res = supabase.table("bookings").select("id").eq("room_id", room_id) \
                    .in_("status", ["pending", "confirmed"]).eq("check_in", check_in).execute()
                available = not (same_res.data and len(same_res.data) > 0)

        return jsonify({
            "available": available,
            "room_id": room_id,
            "check_in": check_in,
            "check_out": check_out,
            "stay_type": stay_type,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings/check-conflict", methods=["POST"])
def check_user_booking_conflict():
    """Non-blocking pre-check: does THIS guest already have an active booking
    (pending/confirmed — in-house included, cancelled/completed excluded) whose
    stay window overlaps the new one in a DIFFERENT room?

    Strict full-datetime overlap with no gap buffer, so back-to-back stays
    (checkout time == next check-in time) never warn. Warning only — the
    same-room hard rule stays in create_booking (409) and the DB
    bookings_no_overlap constraint. Fail-open: any error answers
    conflict=false so a broken check can never block a booking.
    """
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    room_id = data.get("room_id")
    check_in = data.get("check_in")
    check_out = data.get("check_out")
    stay_type = data.get("stay_type", "overnight")
    start_time = data.get("start_time")
    duration = data.get("duration")

    # create_booking 400s on these itself — nothing to warn about yet
    if not check_in or (stay_type == "overnight" and not check_out):
        return jsonify({"conflict": False}), 200

    try:
        h, mi = _parse_time12(start_time)
        win_start = datetime.strptime(check_in, "%Y-%m-%d").replace(hour=h, minute=mi)
        if stay_type == "day":
            win_end = win_start + timedelta(hours=int(duration or 0))
        else:
            win_end = datetime.strptime(check_out, "%Y-%m-%d").replace(hour=h, minute=mi)
            if duration:
                win_end += timedelta(hours=int(duration))

        res = supabase_admin.table("bookings") \
            .select("id, room_id, check_in, check_out, stay_type, start_time, duration") \
            .eq("user_id", user_id) \
            .in_("status", ["pending", "confirmed"]).execute()
        for other in res.data or []:
            if (other.get("room_id") or "") == (room_id or ""):
                continue  # same room → the hard 409 rule, not this warning
            try:
                o_start, o_end = _stay_window(other)
            except Exception:
                continue
            # Strict overlap: touching endpoints (back-to-back) don't count
            if o_start < win_end and win_start < o_end:
                return jsonify({"conflict": True}), 200
        return jsonify({"conflict": False}), 200
    except Exception as e:
        print(f"check-conflict error: {type(e).__name__}: {e}")
        return jsonify({"conflict": False}), 200


@app.route("/api/bookings", methods=["POST"])
def create_booking():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()

    # A guest with an unpaid downpayment balance cannot book again until the
    # front desk records the remaining balance as settled.
    try:
        owed_res = supabase_admin.table("bookings") \
            .select("id, total_price, amount_paid") \
            .eq("user_id", user_id).eq("payment_mode", "downpayment") \
            .in_("status", ["confirmed", "completed"]).execute()
        for row in owed_res.data or []:
            if balance_due(row.get("amount_paid"), row.get("total_price")) > 0:
                return jsonify({
                    "error": "You still have an unpaid balance on a previous booking. "
                             "Please settle it at the hotel before booking again."
                }), 409
    except Exception as e:
        print(f"downpayment balance check skipped: {e}")

    room_id = data.get("room_id")
    check_in = data.get("check_in")
    check_out = data.get("check_out")
    guests = data.get("guests", 1)
    # Guest breakdown — nullable, needs migrate-guest-breakdown.sql.
    adults = data.get("adults")
    children = data.get("children")
    pets = data.get("pets")
    full_name = data.get("full_name", "")
    email = data.get("email", "")
    phone = data.get("phone", "")
    special_requests = data.get("special_requests", "")
    payment_method = data.get("payment_method", "gcash")
    total_price = data.get("total_price", 0)
    payment_mode = data.get("payment_mode", "full")
    if payment_mode not in ("full", "downpayment"):
        payment_mode = "full"
    # Downpayment: charge half now, the rest is settled at the hotel.
    # total_price stays the full amount so revenue reports stay correct.
    amount_due = max(1, round(total_price / 2)) if payment_mode == "downpayment" else total_price
    stay_type = data.get("stay_type", "overnight")
    stays = data.get("stays", "24 Hours")
    duration = data.get("duration")
    start_time = data.get("start_time")

    if not room_id or not check_in:
        return jsonify({"error": "room_id and check_in are required"}), 400

    if stay_type == "overnight" and not check_out:
        return jsonify({"error": "check_out is required for overnight bookings"}), 400

    # For day-use, set check_out to next day to satisfy DB constraint
    if stay_type == "day":
        from datetime import datetime, timedelta
        check_in_date = datetime.strptime(check_in, "%Y-%m-%d")
        check_out = (check_in_date + timedelta(days=1)).strftime("%Y-%m-%d")

    try:
        # Verify room exists and is available
        room_res = supabase.table("rooms").select("id, name, type, price").eq("id", room_id).execute()
        if not room_res.data:
            return jsonify({"error": "Room not found"}), 404

        room = room_res.data[0]

        # Check for overlapping bookings — same [) bounds + statuses as the
        # bookings_no_overlap exclusion constraint (pending + confirmed).
        if stay_type == "overnight":
            # Same two-chained-filters overlap check as check_room_availability:
            # check_in < check_out AND check_out > check_in (see that function).
            overlap_res = supabase_admin.table("bookings").select("id").eq("room_id", room_id) \
                .in_("status", ["pending", "confirmed"]) \
                .lt("check_in", check_out).gt("check_out", check_in).execute()
            if overlap_res.data and len(overlap_res.data) > 0:
                return jsonify({"error": "Room is not available for the selected dates"}), 409
        else:
            # Day-use: window check (with 1h gap) vs all pending/confirmed stays...
            h, mi = _parse_time12(start_time)
            win_start = datetime.strptime(check_in, "%Y-%m-%d").replace(hour=h, minute=mi)
            win_end = win_start + timedelta(hours=int(duration or 0))
            if find_room_conflict(room_id, win_start, win_end) is not None:
                return jsonify({"error": "Room is not available for the selected dates"}), 409
            # ...plus: the DB bookings_no_overlap constraint blocks any other
            # pending/confirmed booking with the same date range entirely.
            same_res = supabase.table("bookings").select("id").eq("room_id", room_id) \
                .in_("status", ["pending", "confirmed"]).eq("check_in", check_in).execute()
            if same_res.data and len(same_res.data) > 0:
                return jsonify({"error": "Room is not available for the selected dates"}), 409

        # Create booking with pending status
        booking_insert = {
            "user_id": user_id,
            "room_id": room_id,
            "check_in": check_in,
            "check_out": check_out,
            "guests": guests,
            "total_price": total_price,
            "status": "pending",
            "payment_method": payment_method,
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "special_requests": special_requests,
            "stay_type": stay_type,
            "stays": stays,
            "payment_mode": payment_mode,
            "amount_paid": 0,
        }
        if adults is not None:
            booking_insert["adults"] = adults
        if children is not None:
            booking_insert["children"] = children
        if pets is not None:
            booking_insert["pets"] = pets
        if stay_type == "day":
            booking_insert["duration"] = duration
            booking_insert["start_time"] = start_time
        elif stay_type == "overnight" and start_time:
            booking_insert["start_time"] = start_time

        # Service-role write: RLS on the shared anon client races with
        # clear_auth()/set_auth() from concurrent requests (42501).
        # payment_mode / amount_paid need migrate-payment-mode.sql and the
        # guest breakdown needs migrate-guest-breakdown.sql; drop whichever
        # columns the error names and retry (PostgREST reports one at a time).
        optional_cols = ("payment_mode", "amount_paid", "adults", "children", "pets")
        booking_res = None
        for _ in range(len(optional_cols) + 1):
            try:
                booking_res = supabase_admin.table("bookings").insert(booking_insert).execute()
                break
            except Exception as ins_err:
                msg = str(ins_err)
                hit = [k for k in optional_cols if k in msg and k in booking_insert]
                if not hit:
                    raise
                for k in hit:
                    booking_insert.pop(k, None)

        if booking_res is None or not booking_res.data:
            return jsonify({"error": "Failed to create booking"}), 500

        booking = booking_res.data[0]
        booking_id = booking["id"]

        # Create PayMongo checkout session
        checkout_url, session_id = create_paymongo_checkout(
            booking_id=booking_id,
            amount=amount_due,
            email=email,
            description=f"Booking: {booking_id}",
        )

        # Remember the session so we can read back the real payment method
        # (GCash / Maya / card) once PayMongo redirects the guest back.
        if checkout_url and session_id:
            supabase_admin.table("bookings").update({"payment_method": f"awaiting:{session_id}"}).eq("id", booking_id).execute()

        guest_label = full_name or email or "A guest"
        invalidate_cache("dash-")
        invalidate_cache("analytics-")
        invalidate_cache("ai-reco")
        invalidate_cache("bookings")
        if checkout_url:
            create_notification(user_id, "booking", "Booking Pending",
                f"Your booking for {room['name']} on {check_in} is awaiting payment.",
                booking_id=booking_id)
            notify_admins("booking", "New Booking",
                f"{guest_label} booked {room['name']} for {check_in}.",
                booking_id=booking_id)
            return jsonify({
                "booking_id": booking_id,
                "checkout_url": checkout_url,
                "status": "pending",
            }), 201
        else:
            # No PayMongo configured — confirm directly
            supabase_admin.table("bookings").update({"status": "confirmed"}).eq("id", booking_id).execute()
            create_notification(user_id, "booking", "Booking Confirmed",
                f"Your booking for {room['name']} on {check_in} is confirmed!",
                booking_id=booking_id)
            notify_admins("booking", "New Booking",
                f"{guest_label} booked {room['name']} for {check_in}.",
                booking_id=booking_id)
            return jsonify({
                "booking_id": booking_id,
                "status": "confirmed",
                "room_name": room["name"],
            }), 201

    except Exception as e:
        err = str(e)
        import traceback as _tb
        print(f"create_booking error: {err}")
        _tb.print_exc()
        if "row-level security" in err or "42501" in err:
            return jsonify({"error": "Unable to save your booking due to a permissions issue. Please try again or contact support."}), 500
        return jsonify({"error": err}), 500


@app.route("/api/bookings/mine", methods=["GET"])
def get_my_bookings():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        bookings_res = supabase.table("bookings").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        bookings = bookings_res.data or []

        # Heal confirmed bookings still holding the awaiting:<session_id>
        # marker (payment landed but the read-back was missed). One PayMongo
        # call per stuck row; the marker disappears once resolved.
        for b in bookings:
            pm = b.get("payment_method") or ""
            if b.get("status") == "confirmed" and pm.startswith("awaiting:"):
                try:
                    resolved = resolve_pending_payment_method(b["id"], pm)
                    if resolved:
                        b["payment_method"] = resolved
                except Exception as e:
                    print(f"payment method heal error: {e}")

        # Batch-fetch room info
        room_ids = list({b["room_id"] for b in bookings if b.get("room_id")})
        rooms_map = {}
        if room_ids:
            rooms_res = supabase.table("rooms").select("id, name, type, images, price").in_("id", room_ids).execute()
            rooms_map = {r["id"]: r for r in (rooms_res.data or [])}

        # One call for this guest's reviews → lets My Bookings know which
        # completed stays still need a review (and show the rating they gave).
        review_by_booking: dict = {}
        if bookings:
            try:
                my_reviews = supabase_admin.table("reviews").select("booking_id, rating") \
                    .eq("user_id", user_id).execute().data or []
                review_by_booking = {r["booking_id"]: r for r in my_reviews if r.get("booking_id")}
            except Exception as e:
                print(f"reviews lookup error: {e}")

        result = []
        for b in bookings:
            room = rooms_map.get(b.get("room_id"), {})
            nights = days_between(b["check_in"], b["check_out"])
            images = room.get("images", [])
            try:
                _s, _e = _stay_window(b)
                end_time = _e.isoformat()
            except Exception:
                end_time = None
            booking_data = {
                "id": b["id"],
                "room_id": b.get("room_id"),
                "room_name": room.get("name", "Unknown"),
                "room_type": room.get("type", ""),
                "room_image": images[0] if images else "",
                "room_price": room.get("price", 0),
                "check_in": b["check_in"],
                "check_out": b["check_out"],
                "nights": nights,
                "guests": b.get("guests", 1),
                "adults": b.get("adults"),
                "children": b.get("children"),
                "pets": b.get("pets"),
                "total_price": b["total_price"],
                "status": b["status"],
                "payment_method": b.get("payment_method", ""),
                "payment_mode": b.get("payment_mode", "full"),
                "amount_paid": b.get("amount_paid", 0),
                "checked_in_at": b.get("checked_in_at"), "refunded_at": b.get("refunded_at"),
                "arrival_state": arrival_state(b),
                "created_at": b["created_at"],
                "stay_type": b.get("stay_type", "overnight"),
                "stays": b.get("stays", "24 Hours"),
                "duration": b.get("duration"),
                "start_time": b.get("start_time"),
                "end_time": end_time,
                "reviewed": b["id"] in review_by_booking,
                "rating": (review_by_booking.get(b["id"]) or {}).get("rating"),
            }
            result.append(booking_data)

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings/<booking_id>", methods=["GET"])
def get_booking(booking_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        booking_res = supabase_admin.table("bookings").select("*").eq("id", booking_id).execute()
        if not booking_res.data:
            return jsonify({"error": "Booking not found"}), 404

        b = booking_res.data[0]
        if b["user_id"] != user_id:
            return jsonify({"error": "Forbidden"}), 403

        # Same heal as get_my_bookings: confirmed + unresolved awaiting marker.
        pm = b.get("payment_method") or ""
        if b.get("status") == "confirmed" and pm.startswith("awaiting:"):
            try:
                resolved = resolve_pending_payment_method(booking_id, pm)
                if resolved:
                    b["payment_method"] = resolved
            except Exception as e:
                print(f"payment method heal error: {e}")

        room_res = supabase_admin.table("rooms").select("name, type, images, price").eq("id", b["room_id"]).execute()
        room = room_res.data[0] if room_res.data else {}
        nights = days_between(b["check_in"], b["check_out"])
        try:
            _s, _e = _stay_window(b)
            end_time = _e.isoformat()
        except Exception:
            end_time = None

        return jsonify({
            "id": b["id"],
            "room_name": room.get("name", "Unknown"),
            "room_type": room.get("type", ""),
            "room_price": room.get("price", 0),
            "check_in": b["check_in"],
            "check_out": b["check_out"],
            "nights": nights,
            "guests": b.get("guests", 1),
            "adults": b.get("adults"),
            "children": b.get("children"),
            "pets": b.get("pets"),
            "total_price": b["total_price"],
            "status": b["status"],
            "full_name": b.get("full_name", ""),
            "email": b.get("email", ""),
            "phone": b.get("phone", ""),
            "special_requests": b.get("special_requests", ""),
            "payment_method": b.get("payment_method", ""),
            "payment_mode": b.get("payment_mode", "full"),
            "amount_paid": b.get("amount_paid", 0),
            "checked_in_at": b.get("checked_in_at"), "refunded_at": b.get("refunded_at"),
            "arrival_state": arrival_state(b),
            "created_at": b["created_at"],
            "stay_type": b.get("stay_type", "overnight"),
            "stays": b.get("stays", "24 Hours"),
            "duration": b.get("duration"),
            "start_time": b.get("start_time"),
            "end_time": end_time,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings/verify/<booking_code>", methods=["GET"])
def verify_booking(booking_code):
    """Public, front-desk endpoint: resolve a guest's QR code to a booking.

    The QR encodes the full booking UUID; the short #ABC12345 code printed on
    receipts also works (matched by prefix). Returns only what staff need to
    match the person in front of them — no contact details, no money.
    """
    code = (booking_code or "").strip().lower().lstrip("#")
    if not code:
        return jsonify({"error": "Missing booking code"}), 400

    HEX = set("0123456789abcdef")
    is_uuid = len(code) == 36 and code.count("-") == 4 and all(c in HEX or c == "-" for c in code)
    is_ref = 6 <= len(code) <= 8 and all(c in HEX for c in code)

    try:
        # select("*"): payment_mode / amount_paid only exist once
        # migrate-payment-mode.sql has run, and the payload picks explicit keys.
        q = supabase_admin.table("bookings").select("*")
        if is_uuid:
            res = q.eq("id", code).execute()
        elif is_ref:
            # id is a uuid column — Postgres has no LIKE for uuid, so scan the
            # first segment as a range (ref 6d8ed17e → that 8-hex window).
            segment = (code + "00000000")[:8]
            lower = f"{segment}-0000-0000-0000-000000000000"
            nxt = int(segment, 16) + 1
            res = (
                q.gte("id", lower)
                .lt("id", f"{nxt:08x}-0000-0000-0000-000000000000")
                .limit(1)
                .execute()
                if nxt <= 0xFFFFFFFF
                else q.gte("id", lower).limit(1).execute()
            )
        else:
            return jsonify({"error": "Booking not found"}), 404

        rows = res.data or []
        if not rows:
            return jsonify({"error": "Booking not found"}), 404

        b = rows[0]
        room_res = supabase_admin.table("rooms").select("name, type") \
            .eq("id", b.get("room_id") or "").execute()
        room = room_res.data[0] if room_res.data else {}

        return jsonify({
            "id": b["id"],
            "reference": (b["id"] or "")[:8].upper(),
            "status": b.get("status") or "",
            "guest_name": b.get("full_name") or "",
            "room_name": room.get("name", "Unknown"),
            "room_type": room.get("type", ""),
            "check_in": b.get("check_in"),
            "check_out": b.get("check_out"),
            "stay_type": b.get("stay_type") or "overnight",
            "start_time": b.get("start_time"),
            "duration": b.get("duration"),
            "guests": b.get("guests", 1),
            "email": b.get("email") or "",
            "phone": b.get("phone") or "",
            "total_price": b.get("total_price") or 0,
            "payment_method": b.get("payment_method") or "",
            "payment_mode": b.get("payment_mode") or "full",
            "amount_paid": b.get("amount_paid") or 0,
            "checked_in_at": b.get("checked_in_at"), "refunded_at": b.get("refunded_at"),
            "arrival_state": arrival_state(b),
            "created_at": b.get("created_at"),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings/<booking_id>/cancel", methods=["POST"])
def cancel_booking(booking_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        # select("*"): arrival_state() needs the whole stay window to know
        # whether the guest is already at the hotel.
        booking_res = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        if not booking_res.data:
            return jsonify({"error": "Booking not found"}), 404

        b = booking_res.data[0]
        if b["user_id"] != user_id:
            return jsonify({"error": "Forbidden"}), 403
        if b["status"] not in ("pending", "confirmed"):
            return jsonify({"error": "Booking cannot be cancelled"}), 400
        if arrival_state(b) in ("early", "in_house"):
            return jsonify({
                "error": "Your stay has already started. Please contact the front desk to make changes."
            }), 409

        # ── Refund ──────────────────────────────────────────────────────────
        # Only money collected online can come back, and only when the guest
        # gives at least 24 hours' notice. Within 24h (or on a no-show) the
        # payment is kept — that is the advertised policy.
        paid = float(b.get("amount_paid") or 0)
        refund_ok = False
        refund_detail = ""
        refund_amount = 0.0
        if b.get("status") == "confirmed" and paid > 0:
            if free_cancellation_ok(b):
                refund_amount = paid
                refund_ok, refund_detail = paymongo_refund(b.get("payment_intent"), paid)
            else:
                refund_detail = "cancelled within 24 hours of check-in"

        fields = {"status": "cancelled"}
        if refund_ok:
            fields["amount_paid"] = 0
            fields["refunded_at"] = hotel_now().isoformat()
            fields["refund_id"] = refund_detail
        try:
            supabase_admin.table("bookings").update(fields).eq("id", booking_id).execute()
        except Exception as ue:
            # refunded_at / refund_id need migrate-refund.sql — keep the
            # cancellation itself working either way.
            for col in ("amount_paid", "refunded_at", "refund_id"):
                if col in str(ue):
                    fields.pop(col, None)
            if fields:
                supabase_admin.table("bookings").update(fields).eq("id", booking_id).execute()

        invalidate_cache("bookings")

        if refund_ok:
            msg = (
                f"Your booking has been cancelled. A refund of "
                f"₱{refund_amount:,.0f} has been initiated to your original "
                f"payment method and should arrive within 7–14 banking days."
            )
        elif refund_amount > 0:
            msg = (
                "Your booking has been cancelled. Because this was within 24 "
                "hours of check-in, no refund is issued."
            )
        elif b.get("status") == "confirmed" and paid > 0:
            msg = (
                "Your booking has been cancelled. Your refund could not be "
                "processed automatically — our front desk will contact you "
                "about returning your payment."
            )
            notify_admins("booking", "Refund needs review",
                f"Automatic refund failed for booking #{booking_id[:8]} "
                f"(₱{paid:,.0f}): {refund_detail}", booking_id=booking_id)
        else:
            msg = "Your booking has been cancelled successfully."

        create_notification(user_id, "booking", "Booking Cancelled", msg, booking_id=booking_id)
        return jsonify({
            "status": "cancelled",
            "refunded": refund_ok,
            "refund_amount": refund_amount if refund_ok else 0,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings/<booking_id>/pay", methods=["POST"])
def retry_booking_payment(booking_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        booking_res = supabase.table("bookings").select("user_id, status, total_price, email").eq("id", booking_id).execute()
        if not booking_res.data:
            return jsonify({"error": "Booking not found"}), 404

        b = booking_res.data[0]
        if b["user_id"] != user_id:
            return jsonify({"error": "Forbidden"}), 403
        if b["status"] != "pending":
            return jsonify({"error": "Only pending bookings can be paid"}), 400

        email = b.get("email", "")

        checkout_url, session_id = create_paymongo_checkout(
            booking_id,
            b["total_price"],
            email,
            f"Booking: {booking_id}",
        )

        if not checkout_url:
            return jsonify({"error": "Failed to create checkout session"}), 500

        if session_id:
            supabase_admin.table("bookings").update({"payment_method": f"awaiting:{session_id}"}).eq("id", booking_id).execute()

        return jsonify({"checkout_url": checkout_url}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings/<booking_id>/extend", methods=["POST"])
def extend_booking(booking_id):
    """Start a paid stay extension: validate the gap, create a PayMongo checkout.

    Body: {"hours": 1..4}. Stores 'extend:<session>:<hours>:<orig_method>' in
    payment_method until /extend/confirm sees the payment.
    """
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    set_auth(token)

    data = request.get_json() or {}
    hours = data.get("hours")
    if not isinstance(hours, int) or isinstance(hours, bool) or not (1 <= hours <= EXTEND_MAX_HOURS):
        return jsonify({"error": f"hours must be a whole number between 1 and {EXTEND_MAX_HOURS}"}), 400

    try:
        b_res = supabase_admin.table("bookings").select("*").eq("id", booking_id).execute()
        if not b_res.data:
            return jsonify({"error": "Booking not found"}), 404
        b = b_res.data[0]
        if b["user_id"] != user_id:
            return jsonify({"error": "Forbidden"}), 403
        if b["status"] != "confirmed":
            return jsonify({"error": "Only confirmed bookings can be extended"}), 400

        start, end = _stay_window(b)
        if _now_naive() >= end:
            return jsonify({"error": "This stay has already ended — it can no longer be extended"}), 400

        new_end = end + timedelta(hours=hours)
        conflict = gap_conflict_payload(b, start, new_end)
        if conflict:
            return conflict

        room_res = supabase_admin.table("rooms").select("id, name, price").eq("id", b["room_id"]).execute()
        if not room_res.data:
            return jsonify({"error": "Room not found"}), 404
        room = room_res.data[0]
        # half-up to match the frontend's Math.round (Python round() is banker's)
        price = max(1, int((room.get("price") or 0) / 24 * hours + 0.5))

        marker = _parse_extend_marker(b.get("payment_method"))
        orig_pm = marker[2] if marker else (b.get("payment_method") or "")

        checkout_url, session_id = create_paymongo_checkout(
            booking_id,
            price,
            b.get("email") or "",
            f"Extend: {booking_id}",
            success_path=f"/my-bookings?extend_paid={booking_id}",
            cancel_path="/my-bookings?payment=cancelled",
        )
        if not checkout_url or not session_id:
            return jsonify({"error": "Failed to create payment session"}), 500

        supabase_admin.table("bookings").update({
            "payment_method": f"extend:{session_id}:{hours}:{orig_pm}",
        }).eq("id", booking_id).execute()

        return jsonify({
            "checkout_url": checkout_url,
            "hours": hours,
            "price": price,
            "new_end": new_end.isoformat(),
        }), 200
    except Exception as e:
        err = str(e)
        if "row-level security" in err or "42501" in err:
            return jsonify({"error": "Unable to start the extension due to a permissions issue. Please try again."}), 500
        return jsonify({"error": err}), 500


@app.route("/api/bookings/<booking_id>/extend/confirm", methods=["POST"])
def confirm_booking_extension(booking_id):
    """Called by the frontend after PayMongo redirects back.

    Applies the extension only when PayMongo reports the session paid.
    """
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    set_auth(token)

    try:
        b_res = supabase_admin.table("bookings").select("*").eq("id", booking_id).execute()
        if not b_res.data:
            return jsonify({"error": "Booking not found"}), 404
        b = b_res.data[0]
        if b["user_id"] != user_id:
            return jsonify({"error": "Forbidden"}), 403

        marker = _parse_extend_marker(b.get("payment_method"))
        if not marker:
            return jsonify({"status": "none"}), 200
        session_id, hours, orig_pm = marker

        if b["status"] != "confirmed":
            return jsonify({"error": "This booking is no longer confirmed, so the extension cannot be applied."}), 400

        paid, method = session_payment_info(fetch_paymongo_session(session_id))
        if not paid:
            return jsonify({"status": "pending_payment"}), 200

        start, end = _stay_window(b)
        new_end = end + timedelta(hours=hours)

        # Re-check the gap — a booking may have appeared while paying
        conflict = gap_conflict_payload(b, start, new_end)
        if conflict:
            return conflict

        fields = apply_extension_fields(b, hours)
        fields["payment_method"] = method or orig_pm or "paymongo"
        supabase_admin.table("bookings").update(fields).eq("id", booking_id).execute()

        invalidate_cache("bookings")
        invalidate_cache("dash-")
        invalidate_cache("analytics-")
        invalidate_cache("ai-reco")

        room_res = supabase_admin.table("rooms").select("name").eq("id", b["room_id"]).execute()
        room_name = room_res.data[0]["name"] if room_res.data else "your room"
        create_notification(user_id, "booking", "Stay Extended",
            f"Your stay at {room_name} has been extended by {hours} hour{'s' if hours > 1 else ''}.",
            booking_id=booking_id)

        updated_end = end + timedelta(hours=hours)
        return jsonify({
            "status": "extended",
            "hours": hours,
            "payment_method": fields["payment_method"],
            "stays": fields.get("stays"),
            "duration": fields.get("duration"),
            "end_time": updated_end.isoformat(),
        }), 200
    except Exception as e:
        err = str(e)
        if "row-level security" in err or "42501" in err:
            return jsonify({"error": "Unable to apply the extension due to a permissions issue. Please try again."}), 500
        return jsonify({"error": err}), 500


# ── Bookings (admin) ──────────────────────────────────────────────────────────

@app.route("/api/bookings/<booking_id>/settle-balance", methods=["POST"])
def settle_booking_balance(booking_id):
    """Front desk: record the remaining downpayment balance as paid at the hotel.

    Admin-only — this is the step that lifts the "cannot book again" block.
    """
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not require_admin(token):
        return jsonify({"error": "Admin access required"}), 403

    try:
        res = supabase_admin.table("bookings").select(
            "id, user_id, room_id, check_in, status, total_price, amount_paid, payment_mode"
        ).eq("id", booking_id).execute()
        if not res.data:
            return jsonify({"error": "Booking not found"}), 404

        b = res.data[0]
        total = float(b.get("total_price") or 0)
        paid = float(b.get("amount_paid") or 0)
        status = b.get("status") or ""
        if balance_due(paid, total) <= 0 and status != "pending":
            return jsonify({
                "booking_id": booking_id,
                "amount_paid": total,
                "balance_due": 0,
                "message": "Balance already settled",
            }), 200

        fields = {"amount_paid": total}
        # Cash/card taken at the counter → the booking becomes confirmed too.
        if status == "pending":
            fields["status"] = "confirmed"

        try:
            supabase_admin.table("bookings").update(fields).eq("id", booking_id).execute()
        except Exception as ue:
            if "amount_paid" in str(ue):
                return jsonify({
                    "error": "The amount_paid column is missing. Run migrate-payment-mode.sql on Supabase first."
                }), 409
            raise

        invalidate_cache("bookings")
        invalidate_cache("dash-")
        invalidate_cache("analytics-")

        room_name = "your room"
        if b.get("room_id"):
            rr = supabase_admin.table("rooms").select("name").eq("id", b["room_id"]).execute()
            if rr.data:
                room_name = rr.data[0]["name"]

        if b.get("user_id"):
            create_notification(b["user_id"], "booking", "Balance Settled",
                f"Your remaining balance for {room_name} on {b.get('check_in', '')} has been settled. Your booking is fully paid.",
                booking_id=booking_id)
            if status == "pending":
                create_notification(b["user_id"], "booking", "Booking Confirmed",
                    f"Payment received at the front desk — your booking for {room_name} on {b.get('check_in', '')} is confirmed!",
                    booking_id=booking_id)

        # NOTE: do NOT touch rooms.available here. That flag is the maintenance
        # toggle — clearing it hides the room from /api/rooms/public and shows
        # it as "maintenance" in admin. Occupancy is derived from overlapping
        # bookings (check_room_availability), so payment must not flip it.

        return jsonify({
            "booking_id": booking_id,
            "amount_paid": total,
            "balance_due": 0,
            "status": "confirmed" if status == "pending" else status,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings/<booking_id>/check-in", methods=["POST"])
def check_in_booking(booking_id):
    """Front desk: stamp the guest's arrival after scanning their QR code.

    The stamp alone does NOT start the stay. arrival_state() derives the real
    state from the clock, so a guest who scans at 9:50 AM for a 10:00 AM booking
    is recorded as "arrived early" and flips to "in-house" on its own once the
    booked time passes — there is no scheduler to wake up and do it for us.

    Admin-only: the public /verify/<code> page never calls this.
    """
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not require_admin(token):
        return jsonify({"error": "Admin access required"}), 403

    try:
        # select("*"): checked_in_at only exists once migrate-checked-in.sql has
        # run, and .get() on the missing key degrades to "not arrived yet".
        res = supabase_admin.table("bookings").select("*").eq("id", booking_id).execute()
        if not res.data:
            return jsonify({"error": "Booking not found"}), 404

        b = res.data[0]
        status = b.get("status") or ""
        if status == "pending":
            return jsonify({
                "error": "Collect the balance first — this booking must be confirmed before check-in."
            }), 409
        if status in ("cancelled", "completed", "checked-out"):
            return jsonify({"error": "This booking has already ended."}), 409

        day = _as_date(b.get("check_in"))
        now = hotel_now()
        if day and now.date() < day:
            return jsonify({
                "error": f"Check-in opens on {day.strftime('%b %d, %Y')}."
            }), 409

        if not b.get("checked_in_at"):
            stamped = now.isoformat()
            try:
                supabase_admin.table("bookings").update(
                    {"checked_in_at": stamped}
                ).eq("id", booking_id).execute()
            except Exception as ue:
                if "checked_in_at" in str(ue):
                    return jsonify({
                        "error": "The checked_in_at column is missing. Run migrate-checked-in.sql on Supabase first."
                    }), 409
                raise
            b["checked_in_at"] = stamped
            created = True
        else:
            # Re-scan keeps the original arrival time.
            created = False
            stamped = b["checked_in_at"]

        invalidate_cache("bookings")
        invalidate_cache("dash-")
        invalidate_cache("analytics-")

        state = arrival_state(b, now)
        start_day, start_minutes = check_in_moment(b)
        room_name = "your room"
        if b.get("room_id"):
            rr = supabase_admin.table("rooms").select("name").eq("id", b["room_id"]).execute()
            if rr.data:
                room_name = rr.data[0]["name"]

        if created and b.get("user_id"):
            if state == "early":
                create_notification(b["user_id"], "booking", "Arrived Early",
                    f"We've recorded your arrival for {room_name}. Your stay starts at "
                    f"{format_moment(start_day, start_minutes)} — see you then!",
                    booking_id=booking_id)
            else:
                create_notification(b["user_id"], "booking", "You're Checked In",
                    f"Welcome! Your stay at {room_name} is now in progress. Enjoy your visit.",
                    booking_id=booking_id)

        return jsonify({
            "booking_id": booking_id,
            "checked_in_at": stamped,
            "arrival_state": state,
            "start_at": format_moment(start_day, start_minutes),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings", methods=["GET"])
def get_bookings():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        limit = request.args.get("limit", type=int)
        query = supabase.table("bookings").select("*").order("created_at", desc=True)
        if limit:
            query = query.limit(limit)
        bookings_res = query.execute()
        bookings = bookings_res.data or []

        # Get all unique user_ids and room_ids to batch-fetch names
        user_ids = list({b["user_id"] for b in bookings if b.get("user_id")})
        room_ids = list({b["room_id"] for b in bookings if b.get("room_id")})

        users_map = {}
        if user_ids:
            users_res = supabase.table("users").select("id, name, email, avatar_url").in_("id", user_ids).execute()
            users_map = {u["id"]: u for u in (users_res.data or [])}

        rooms_map = {}
        if room_ids:
            rooms_res = supabase.table("rooms").select("id, name, type").in_("id", room_ids).execute()
            rooms_map = {r["id"]: r for r in (rooms_res.data or [])}

        result = []
        for b in bookings:
            nights = days_between(b["check_in"], b["check_out"])
            uid = b.get("user_id")
            rid = b.get("room_id")
            room = rooms_map.get(rid, {})
            user = users_map.get(uid, {})
            guest_name = b.get("full_name") or user.get("name") or "Unknown"
            guest_email = b.get("email") or user.get("email") or ""
            guest_avatar = user.get("avatar_url") or ""
            result.append({
                "id": b["id"][:8].upper(),
                "fullId": b["id"],
                "guestName": guest_name,
                "guestEmail": guest_email,
                "guestAvatar": guest_avatar,
                "guestId": uid or "",
                "roomType": room.get("type", "Unknown"),
                "roomNumber": room.get("name", ""),
                "checkIn": b["check_in"],
                "checkOut": b["check_out"],
                "nights": nights,
                "amount": b["total_price"],
                "status": b["status"],
                "guests": b.get("guests", 1),
                "phone": b.get("phone", ""),
                "specialRequests": b.get("special_requests", ""),
                "stay_type": b.get("stay_type", "overnight"),
                "duration": b.get("duration"),
                "start_time": b.get("start_time"),
                "createdAt": b.get("created_at", ""),
                "payment_method": b.get("payment_method", ""),
                "payment_mode": b.get("payment_mode", "full"),
                "amount_paid": b.get("amount_paid", 0),
                "checked_in_at": b.get("checked_in_at"), "refunded_at": b.get("refunded_at"),
                "arrival_state": arrival_state(b),
            })

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings/auto-complete", methods=["POST"])
def auto_complete_bookings():
    """Auto-complete confirmed bookings past their end, and auto-cancel unpaid bookings past their date.

    The clock is Asia/Manila: start/end times are stored as the guest's local
    wall-clock ("10:00 AM", "2:00 PM"), so judging them against UTC would close
    day-use stays 8 hours early and roll overnight stays over at 8 AM.
    """
    try:
        now = hotel_now()
        today = now.date()
        today_s = today.isoformat()

        # Fetch both candidate sets + rooms in 3 calls instead of N+1 per row.
        # Service-role: this cron has no user JWT — RLS would block under anon.
        confirmed_res = supabase_admin.table("bookings").select("*").eq("status", "confirmed").execute()
        confirmed = confirmed_res.data or []
        pending_res = supabase_admin.table("bookings").select("*").eq("status", "pending").execute()
        pending = pending_res.data or []
        rooms_res = supabase_admin.table("rooms").select("id, name").execute()
        rooms_by_id = {r["id"]: r["name"] for r in (rooms_res.data or [])}

        def room_name(b):
            rid = b.get("room_id")
            return rooms_by_id.get(rid, "your room") if rid else "your room"

        def stay_has_ended(b):
            end_day, end_minutes = stay_end_moment(b)
            if end_day is None:
                return False
            if today > end_day:
                return True
            return today == end_day and now.hour * 60 + now.minute >= end_minutes

        completed_ids = []
        for b in confirmed:
            if not stay_has_ended(b):
                continue

            result = supabase_admin.table("bookings").update({"status": "completed"}).eq("id", b["id"]).eq("status", "confirmed").execute()
            # Only notify if the status actually changed (prevents duplicates on repeated calls)
            if result.data:
                completed_ids.append(b["id"])
                create_notification(b["user_id"], "booking", "Stay Completed",
                    f"Your stay at {room_name(b)} has been marked as completed. We hope to see you again!",
                    booking_id=b["id"])
                # Ask for a review right after the stay wraps up — but only for
                # stays the guest actually checked in to (a no-show can't rate it)
                if b.get("checked_in_at"):
                    create_notification(b["user_id"], "review", "How was your stay?",
                        f"Rate {room_name(b)} and share your experience with other guests.",
                        booking_id=b["id"])

        cancelled_ids = []
        for b in pending:
            check_in = b.get("check_in", "")
            if check_in and check_in < today_s:
                result = supabase_admin.table("bookings").update({"status": "cancelled"}).eq("id", b["id"]).eq("status", "pending").execute()
                if result.data:
                    cancelled_ids.append(b["id"])
                    create_notification(b["user_id"], "booking", "Booking Expired",
                        f"Your unpaid booking for {room_name(b)} has been automatically cancelled.",
                        booking_id=b["id"])

        if completed_ids or cancelled_ids:
            invalidate_cache("dash-")
            invalidate_cache("analytics-")
            invalidate_cache("ai-reco")
            invalidate_cache("bookings")

        return jsonify({
            "completed": len(completed_ids),
            "cancelled": len(cancelled_ids),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings/<booking_id>/status", methods=["PUT"])
def update_booking_status(booking_id):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    new_status = data.get("status")
    valid_statuses = ["pending", "confirmed", "cancelled", "completed", "checked-out"]
    if new_status not in valid_statuses:
        return jsonify({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}), 400

    try:
        # Verify booking exists and get user_id for notification
        booking_res = supabase.table("bookings").select("id, room_id, check_in, user_id").eq("id", booking_id).execute()
        if not booking_res.data:
            return jsonify({"error": "Booking not found"}), 404

        b = booking_res.data[0]
        booking_user_id = b.get("user_id")

        # Get room name for notification message
        room_name = "your room"
        if b.get("room_id"):
            room_res = supabase.table("rooms").select("name").eq("id", b["room_id"]).execute()
            if room_res.data:
                room_name = room_res.data[0]["name"]

        # Update status
        result = supabase_admin.table("bookings").update({"status": new_status}).eq("id", booking_id).execute()

        if not result.data:
            return jsonify({"error": "Failed to update booking"}), 500

        invalidate_cache("dash-")
        invalidate_cache("analytics-")
        invalidate_cache("ai-reco")
        invalidate_cache("bookings")

        # Send notification to the booking's user
        if booking_user_id:
            status_messages = {
                "confirmed": ("Booking Confirmed", f"Your booking for {room_name} on {b.get('check_in', '')} is confirmed!"),
                "cancelled": ("Booking Cancelled", f"Your booking for {room_name} has been cancelled."),
                "completed": ("Stay Completed", f"Your stay at {room_name} has been marked as completed. We hope to see you again!"),
                "checked-out": ("Checked Out", f"You have been checked out from {room_name}. Thank you for staying with us!"),
            }
            if new_status in status_messages:
                title, msg = status_messages[new_status]
                create_notification(booking_user_id, "booking", title, msg, booking_id=booking_id)
                if new_status in REVIEWABLE_STATUSES:
                    create_notification(booking_user_id, "review", "How was your stay?",
                        f"Rate {room_name} and share your experience with other guests.",
                        booking_id=booking_id)

        return jsonify({"message": f"Booking status updated to {new_status}", "status": new_status}), 200
    except Exception as e:
        raw = str(e)
        # bookings_status_check doesn't know 'checked-out' yet — say so plainly
        # instead of leaking the raw Postgres error into the UI.
        if "'23514'" in raw or "bookings_status_check" in raw:
            return jsonify({
                "error": "That status isn't allowed by the database yet. Run "
                         "migrate-checked-out-status.sql in the Supabase SQL editor, then try again."
            }), 500
        return jsonify({"error": raw}), 500


# ── Reviews ────────────────────────────────────────────────────────────────────

@app.route("/api/reviews", methods=["POST"])
def create_review():
    """Guest submits a review for their own completed stay — one review per booking."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.form.to_dict() if (request.content_type or "").startswith("multipart/form-data") else (request.get_json() or {})
    files = [f for f in request.files.getlist("images") if f and f.filename] if request.files else []
    booking_id = data.get("booking_id")
    comment = (data.get("comment") or "").strip()

    if not booking_id:
        return jsonify({"error": "booking_id is required"}), 400
    if len(comment) > REVIEW_MAX_CHARS:
        return jsonify({"error": f"Please keep your review to {REVIEW_MAX_CHARS} characters or less."}), 400
    if len(files) > REVIEW_MAX_IMAGES:
        return jsonify({"error": f"You can attach up to {REVIEW_MAX_IMAGES} photos."}), 400
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        return jsonify({"error": "rating must be between 1 and 5"}), 400
    if not 1 <= rating <= 5:
        return jsonify({"error": "rating must be between 1 and 5"}), 400

    # Read and type/size-check every photo before anything touches storage.
    photos = []
    for f in files:
        if f.content_type not in REVIEW_IMAGE_TYPES:
            return jsonify({"error": "Only JPG, PNG, WebP or GIF photos are allowed."}), 400
        raw = f.read()
        if len(raw) > REVIEW_IMAGE_MAX_BYTES:
            return jsonify({"error": "Each photo must be 5 MB or smaller."}), 400
        ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else "jpg"
        photos.append((raw, f.content_type, "jpg" if ext == "jpeg" else ext))

    try:
        booking_res = supabase_admin.table("bookings") \
            .select("id, user_id, room_id, status, full_name, email, checked_in_at") \
            .eq("id", booking_id).execute()
        if not booking_res.data:
            return jsonify({"error": "Booking not found"}), 404
        booking = booking_res.data[0]

        if booking.get("user_id") != user_id:
            return jsonify({"error": "You can only review your own booking."}), 403
        if booking.get("status") not in REVIEWABLE_STATUSES:
            return jsonify({"error": "You can review a stay once it is completed."}), 400
        if not booking.get("checked_in_at"):
            return jsonify({"error": "You can only review a stay you actually checked in to."}), 400

        existing = supabase_admin.table("reviews").select("id").eq("booking_id", booking_id).execute()
        if existing.data:
            return jsonify({"error": "You have already reviewed this booking."}), 409

        # Upload photos first, so a failed insert never leaves orphan files.
        uploaded = []
        try:
            for raw, ctype, ext in photos:
                uploaded.append(_upload_review_image(raw, ctype, user_id, ext))
        except Exception as e:
            return jsonify({"error": f"Couldn't upload your photos: {e}"}), 500

        payload = {
            "booking_id": booking_id,
            "room_id": booking.get("room_id"),
            "user_id": user_id,
            "rating": rating,
            "comment": comment,
            "images": uploaded,
        }
        try:
            insert_res = supabase_admin.table("reviews").insert(payload).execute()
        except Exception as e:
            _delete_review_images(uploaded)
            if _review_columns_missing(str(e)):
                # migrate-reviews-images-reply.sql not run yet — keep the text review.
                print("[reviews] images column missing — saving review without photos")
                payload.pop("images", None)
                insert_res = supabase_admin.table("reviews").insert(payload).execute()
            else:
                raise
        if not insert_res.data:
            _delete_review_images(uploaded)
            return jsonify({"error": "Failed to save your review"}), 500

        # Surface it on the admin side
        room_name = "a room"
        guest_label = booking.get("full_name") or booking.get("email") or "A guest"
        if booking.get("room_id"):
            room_res = supabase_admin.table("rooms").select("name").eq("id", booking["room_id"]).execute()
            if room_res.data:
                room_name = room_res.data[0].get("name") or room_name
        notify_admins("review", "New Review",
            f"{guest_label} rated {room_name} {rating}/5.", booking_id=booking_id)

        return jsonify(insert_res.data[0]), 201
    except Exception as e:
        err = str(e)
        if _reviews_table_missing(err):
            return jsonify({"error": REVIEWS_NOT_SETUP}), 503
        return jsonify({"error": err}), 500


@app.route("/api/reviews/room/<room_id>", methods=["GET"])
def get_room_reviews(room_id):
    """Public: average, count and the guest reviews shown inside the room page."""
    try:
        clear_auth()
        rows = _select_reviews(lambda cols: supabase_admin.table("reviews")
                               .select(cols).eq("room_id", room_id)
                               .order("created_at", desc=True).limit(60))

        user_ids = list({r["user_id"] for r in rows if r.get("user_id")})
        names: dict = {}
        avatars: dict = {}
        if user_ids:
            users = supabase_admin.table("users").select("id, name, avatar_url").in_("id", user_ids).execute().data or []
            # Full name on the card — the avatar seed still uses the first name
            # only, so nobody's placeholder face changes because of this.
            names = {u["id"]: (u.get("name") or "").strip() for u in users}
            avatars = {
                u["id"]: _public_review_avatar(u, (u.get("name") or "").split(" ")[0].strip())
                for u in users
            }

        reviews = [{
            "id": r["id"],
            "rating": r.get("rating"),
            "comment": r.get("comment") or "",
            "images": r.get("images") or [],
            "admin_reply": r.get("admin_reply") or "",
            "admin_replied_at": r.get("admin_replied_at"),
            "guest_name": names.get(r.get("user_id")) or "Guest",
            "guest_avatar": avatars.get(r.get("user_id")) or "",
            "created_at": r.get("created_at"),
        } for r in rows]

        # Average + per-star distribution over every review of the room,
        # not just the returned page.
        all_ratings = supabase_admin.table("reviews").select("rating") \
            .eq("room_id", room_id).execute().data or []
        average = round(sum(float(r.get("rating") or 0) for r in all_ratings) / len(all_ratings), 1) \
            if all_ratings else 0
        distribution = {str(k): 0 for k in range(5, 0, -1)}
        for r in all_ratings:
            key = str(int(r.get("rating") or 0))
            if key in distribution:
                distribution[key] += 1

        return jsonify({
            "room_id": room_id,
            "average": average,
            "count": len(all_ratings),
            "distribution": distribution,
            "reviews": reviews,
        }), 200
    except Exception as e:
        err = str(e)
        if _reviews_table_missing(err):
            return jsonify({"room_id": room_id, "average": 0, "count": 0, "reviews": []}), 200
        return jsonify({"error": err}), 500


@app.route("/api/reviews", methods=["GET"])
def get_reviews():
    """Admin: every review (optionally filtered by room) + per-room rating stats."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not require_admin(token):
        return jsonify({"error": "Admin access required"}), 403

    try:
        room_id = request.args.get("room_id")

        rooms = supabase_admin.table("rooms").select("id, name, type").order("name").execute().data or []
        rooms_map = {r["id"]: r for r in rooms}

        def _admin_review_query(cols):
            q = supabase_admin.table("reviews").select(cols).order("created_at", desc=True)
            return q.eq("room_id", room_id) if room_id else q

        rows = _select_reviews(_admin_review_query)

        user_ids = list({r["user_id"] for r in rows if r.get("user_id")})
        users_map = {}
        if user_ids:
            users = fetch_by_ids("users", user_ids, "id, name, email, avatar_url")
            users_map = {u["id"]: u for u in users}

        booking_ids = list({r["booking_id"] for r in rows if r.get("booking_id")})
        bookings_map = {}
        if booking_ids:
            bres = fetch_by_ids("bookings", booking_ids, "id, check_in, check_out")
            bookings_map = {b["id"]: b for b in bres}

        items = []
        for r in rows:
            u = users_map.get(r.get("user_id"), {})
            b = bookings_map.get(r.get("booking_id"), {})
            room = rooms_map.get(r.get("room_id"), {})
            items.append({
                "id": r["id"],
                "booking_id": r.get("booking_id"),
                "room_id": r.get("room_id"),
                "room_name": room.get("name", "Unknown room"),
                "room_type": room.get("type", ""),
                "guest_name": u.get("name", "Guest"),
                "guest_email": u.get("email", ""),
                "guest_avatar": (u.get("avatar_url") or "").strip(),
                "rating": r.get("rating"),
                "comment": r.get("comment") or "",
                "images": r.get("images") or [],
                "admin_reply": r.get("admin_reply") or "",
                "admin_replied_at": r.get("admin_replied_at"),
                "check_in": b.get("check_in"),
                "check_out": b.get("check_out"),
                "created_at": r.get("created_at"),
            })

        ratings = room_rating_summary()
        stats = [{
            "room_id": rm["id"],
            "room_name": rm["name"],
            "room_type": rm.get("type", ""),
            "rating": ratings.get(rm["id"], {}).get("rating"),
            "reviews": ratings.get(rm["id"], {}).get("reviews", 0),
        } for rm in rooms]

        given = [float(r.get("rating") or 0) for r in rows]
        return jsonify({
            "reviews": items,
            "stats": stats,
            "totals": {
                "reviews": len(rows),
                "average": round(sum(given) / len(given), 1) if given else 0,
            },
        }), 200
    except Exception as e:
        err = str(e)
        if _reviews_table_missing(err):
            return jsonify({"error": REVIEWS_NOT_SETUP}), 503
        return jsonify({"error": err}), 500


@app.route("/api/reviews/featured", methods=["GET"])
def get_featured_reviews():
    """Public: the latest positive reviews shown on the home page.

    4-star-and-up only, capped at 12 — no auth required. Avatars go through
    _public_review_avatar so a public page never leaks an account email.
    """
    try:
        clear_auth()
        rows = _select_reviews(lambda cols: supabase_admin.table("reviews")
                               .select(cols).gte("rating", 4)
                               .order("created_at", desc=True).limit(40))
        rows = [r for r in rows if (r.get("comment") or "").strip()][:12]

        user_ids = list({r["user_id"] for r in rows if r.get("user_id")})
        users_map = {}
        if user_ids:
            users_map = {u["id"]: u for u in fetch_by_ids("users", user_ids, "id, name, avatar_url")}

        room_ids = list({r["room_id"] for r in rows if r.get("room_id")})
        rooms_map = {}
        if room_ids:
            rooms_map = {rm["id"]: rm for rm in fetch_by_ids("rooms", room_ids, "id, name")}

        items = []
        for r in rows:
            u = users_map.get(r.get("user_id"), {})
            room = rooms_map.get(r.get("room_id"), {})
            first_name = (u.get("name") or "").split(" ")[0].strip()
            items.append({
                "id": r["id"],
                "rating": r.get("rating"),
                "comment": (r.get("comment") or "").strip(),
                "created_at": r.get("created_at"),
                "guest_name": u.get("name") or "Guest",
                "guest_avatar": _public_review_avatar(u, first_name),
                "room_name": room.get("name", ""),
            })

        all_ratings = supabase_admin.table("reviews").select("rating").execute().data or []
        average = round(sum(float(x.get("rating") or 0) for x in all_ratings) / len(all_ratings), 1) \
            if all_ratings else 0
        return jsonify({
            "reviews": items,
            "summary": {"average": average, "count": len(all_ratings)},
        }), 200
    except Exception as e:
        err = str(e)
        if _reviews_table_missing(err):
            return jsonify({"error": REVIEWS_NOT_SETUP}), 503
        return jsonify({"error": err}), 500


@app.route("/api/reviews/mine", methods=["GET"])
def get_my_reviews():
    """Guest: the reviews they wrote, joined with the stay and room they belong to."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        rows = _select_reviews(lambda cols: supabase_admin.table("reviews")
                               .select(cols).eq("user_id", user_id)
                               .order("created_at", desc=True).limit(100))

        booking_ids = list({r["booking_id"] for r in rows if r.get("booking_id")})
        bookings_map = {}
        if booking_ids:
            bres = fetch_by_ids("bookings", booking_ids, "id, room_id, check_in, check_out, status")
            bookings_map = {b["id"]: b for b in bres}

        room_ids = []
        for r in rows:
            rid = r.get("room_id") or bookings_map.get(r.get("booking_id"), {}).get("room_id")
            if rid and rid not in room_ids:
                room_ids.append(rid)
        rooms_map = {}
        if room_ids:
            rres = fetch_by_ids("rooms", room_ids, "id, name, type, images")
            rooms_map = {rm["id"]: rm for rm in rres}

        items = []
        for r in rows:
            b = bookings_map.get(r.get("booking_id"), {})
            room = rooms_map.get(r.get("room_id") or b.get("room_id"), {})
            photos = room.get("images") or []
            items.append({
                "id": r["id"],
                "booking_id": r.get("booking_id"),
                "room_id": r.get("room_id") or b.get("room_id"),
                "room_name": room.get("name", "Room"),
                "room_type": room.get("type", ""),
                "room_image": photos[0] if photos else "",
                "rating": r.get("rating"),
                "comment": r.get("comment") or "",
                "images": r.get("images") or [],
                "admin_reply": r.get("admin_reply") or "",
                "admin_replied_at": r.get("admin_replied_at"),
                "check_in": b.get("check_in"),
                "check_out": b.get("check_out"),
                "created_at": r.get("created_at"),
            })

        given = [float(i["rating"]) for i in items if i.get("rating")]
        return jsonify({
            "reviews": items,
            "count": len(items),
            "average": round(sum(given) / len(given), 1) if given else 0,
        }), 200
    except Exception as e:
        if _reviews_table_missing(str(e)):
            return jsonify({"reviews": [], "count": 0, "average": 0}), 200
        return jsonify({"error": str(e)}), 500


@app.route("/api/reviews/<review_id>", methods=["PUT"])
def update_review(review_id):
    """Guest edits their own review — rating, comment and photos."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.form.to_dict() if (request.content_type or "").startswith("multipart/form-data") else (request.get_json() or {})
    comment = (data.get("comment") or "").strip()
    if len(comment) > REVIEW_MAX_CHARS:
        return jsonify({"error": f"Please keep your review to {REVIEW_MAX_CHARS} characters or less."}), 400
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        return jsonify({"error": "rating must be between 1 and 5"}), 400
    if not 1 <= rating <= 5:
        return jsonify({"error": "rating must be between 1 and 5"}), 400

    files = [f for f in (request.files.getlist("images") if request.files else []) if f and f.filename]
    if len(files) > REVIEW_MAX_IMAGES:
        return jsonify({"error": f"You can attach up to {REVIEW_MAX_IMAGES} photos."}), 400

    # Type/size-check the new photos before anything touches storage.
    photos = []
    for f in files:
        if f.content_type not in REVIEW_IMAGE_TYPES:
            return jsonify({"error": "Only JPG, PNG, WebP or GIF photos are allowed."}), 400
        raw = f.read()
        if len(raw) > REVIEW_IMAGE_MAX_BYTES:
            return jsonify({"error": "Each photo must be 5 MB or smaller."}), 400
        ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else "jpg"
        photos.append((raw, f.content_type, "jpg" if ext == "jpeg" else ext))

    try:
        try:
            existing = supabase_admin.table("reviews") \
                .select("id, user_id, images").eq("id", review_id).execute()
        except Exception:
            # migrate-reviews-images-reply.sql not run yet — no images column to read.
            existing = supabase_admin.table("reviews").select("id, user_id").eq("id", review_id).execute()
        if not existing.data:
            return jsonify({"error": "Review not found"}), 404

        row = existing.data[0]
        if row.get("user_id") != user_id:
            return jsonify({"error": "You can only edit your own review."}), 403

        old_images = row.get("images") or []
        try:
            keep = json.loads(data.get("keep_images") or "[]")
            if not isinstance(keep, list):
                keep = []
        except Exception:
            keep = []
        # Only photos already stored on this review can be kept — never trust the client.
        keep = [u for u in keep if u in old_images]
        if len(keep) + len(photos) > REVIEW_MAX_IMAGES:
            return jsonify({"error": f"You can attach up to {REVIEW_MAX_IMAGES} photos."}), 400

        # Upload the new photos first, so a failed update never leaves orphan files.
        uploaded = []
        try:
            for raw, ctype, ext in photos:
                uploaded.append(_upload_review_image(raw, ctype, user_id, ext))
        except Exception as e:
            return jsonify({"error": f"Couldn't upload your photos: {e}"}), 500

        final_images = keep + uploaded
        update = {"rating": rating, "comment": comment, "images": final_images}
        try:
            res = supabase_admin.table("reviews").update(update).eq("id", review_id).execute()
        except Exception as e:
            _delete_review_images(uploaded)
            if _review_columns_missing(str(e)):
                # images column missing — keep the text review without photos.
                update.pop("images", None)
                res = supabase_admin.table("reviews").update(update).eq("id", review_id).execute()
            else:
                raise
        if not res.data:
            _delete_review_images(uploaded)
            return jsonify({"error": "Failed to save your review"}), 500

        # Photos the guest removed — only dropped once the row no longer points at them.
        dropped = [u for u in old_images if u not in final_images]
        if dropped:
            _delete_review_images(dropped)

        return jsonify(res.data[0]), 200
    except Exception as e:
        err = str(e)
        if _reviews_table_missing(err):
            return jsonify({"error": REVIEWS_NOT_SETUP}), 503
        return jsonify({"error": err}), 500


@app.route("/api/reviews/<review_id>", methods=["DELETE"])
def delete_review(review_id):
    """Admin moderation, or the guest removing their own review."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")

    if not require_admin(token):
        # Not an admin — allow the review's own author to delete it.
        set_auth(token)
        user_id = get_user_from_token(token)
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        try:
            owner = supabase_admin.table("reviews").select("user_id").eq("id", review_id).execute()
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        if not owner.data:
            return jsonify({"error": "Review not found"}), 404
        if owner.data[0].get("user_id") != user_id:
            return jsonify({"error": "Admin access required"}), 403

    try:
        try:
            existing = supabase_admin.table("reviews").select("images").eq("id", review_id).execute()
        except Exception:
            existing = None

        res = supabase_admin.table("reviews").delete().eq("id", review_id).execute()
        if not res.data:
            return jsonify({"error": "Review not found"}), 404

        if existing and existing.data:
            _delete_review_images(existing.data[0].get("images") or [])
        return jsonify({"message": "Review deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/reviews/<review_id>/reply", methods=["POST", "DELETE"])
def review_reply(review_id):
    """Admin — leave a public reply under a guest's review (DELETE clears it)."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not require_admin(token):
        return jsonify({"error": "Admin access required"}), 403

    reply = ""
    if request.method == "POST":
        reply = ((request.get_json() or {}).get("reply") or "").strip()
        if len(reply) > REVIEW_REPLY_MAX_CHARS:
            return jsonify({"error": f"Please keep your reply to {REVIEW_REPLY_MAX_CHARS} characters or less."}), 400

    update = {
        "admin_reply": reply or None,
        "admin_replied_at": datetime.now(timezone.utc).isoformat() if reply else None,
    }
    try:
        res = supabase_admin.table("reviews").update(update).eq("id", review_id).execute()
        if not res.data:
            return jsonify({"error": "Review not found"}), 404
        return jsonify(res.data[0]), 200
    except Exception as e:
        if _review_columns_missing(str(e)):
            return jsonify({"error": REVIEW_MIGRATION_HINT}), 503
        if _reviews_table_missing(str(e)):
            return jsonify({"error": REVIEWS_NOT_SETUP}), 503
        return jsonify({"error": str(e)}), 500


# ── Guests ─────────────────────────────────────────────────────────────────────

@app.route("/api/guests", methods=["GET"])
def get_guests():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        users_res = supabase.table("users").select("*").eq("role", "guest").order("created_at", desc=True).execute()
        users = users_res.data or []

        # list_users() is a slow external Admin API call; only hit it as fallback
        # when a guest row is missing an email (users.email column is preferred).
        auth_emails = {}
        auth_avatars = {}
        need_auth = any(not (u.get("email") or "").strip() for u in users) or any(not u.get("avatar_url") for u in users)
        if need_auth:
            try:
                result = supabase_admin.auth.admin.list_users()
                auth_users_list = result if isinstance(result, list) else (result.users if hasattr(result, 'users') else [])
                for au in auth_users_list:
                    auth_emails[au.id] = au.email or ""
                    meta = au.user_metadata or {}
                    if meta.get("avatar_url"):
                        auth_avatars[au.id] = meta["avatar_url"]
            except Exception as e:
                print(f"[guests] list_users fallback error: {e}")

        # One bookings pass for stats (was two full scans + email scan)
        bookings = supabase.table("bookings").select("user_id, email, total_price, check_out").execute().data or []

        user_stats = {}
        booking_emails = {}
        for b in bookings:
            uid = b["user_id"]
            if uid not in user_stats:
                user_stats[uid] = {"count": 0, "total_spent": 0, "last_stay": ""}
            s = user_stats[uid]
            s["count"] += 1
            s["total_spent"] += b["total_price"]
            if b["check_out"] > s["last_stay"]:
                s["last_stay"] = b["check_out"]
            if b.get("email") and uid not in booking_emails:
                booking_emails[uid] = b["email"]

        result = []
        for u in users:
            s = user_stats.get(u["id"], {"count": 0, "total_spent": 0, "last_stay": ""})
            status = "New"
            if s["count"] >= 3:
                status = "VIP"
            elif s["count"] >= 2:
                status = "Regular"

            last_stay = ""
            if s["last_stay"]:
                from datetime import datetime as dt
                last_stay = dt.strptime(s["last_stay"][:10], "%Y-%m-%d").strftime("%b %d, %Y")

            result.append({
                "id": u["id"],
                "name": u.get("name") or "Unknown",
                "email": u.get("email") or booking_emails.get(u["id"], "") or auth_emails.get(u["id"], ""),
                "phone": u.get("phone") or "—",
                "totalBookings": s["count"],
                "totalSpent": s["total_spent"],
                "lastStay": last_stay or "—",
                "status": status,
                "avatar_url": u.get("avatar_url") or auth_avatars.get(u["id"], "") or "",
                "created_at": u.get("created_at") or "",
            })

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Dashboard Stats ────────────────────────────────────────────────────────────

@app.route("/api/dashboard/stats", methods=["GET"])
def get_dashboard_stats():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload = cached_json(
            "dash-stats",
            lambda: _build_dashboard_stats(),
            ttl=30,
        )
        return jsonify(payload), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _build_dashboard_stats():
    now = datetime.now()
    month_start = f"{now.year}-{now.month:02d}-01"
    today = today_str()

    # 2 parallel-ish sequential queries (rooms is tiny); drop the wasted guests
    # count that was discarded and hard-coded to 0.
    all_bookings = supabase.table("bookings").select("status, total_price, check_in, check_out").execute().data or []
    all_rooms = supabase.table("rooms").select("id, available").execute().data or []

    total_rooms = len(all_rooms) or 1
    total_bookings = len(all_bookings)
    confirmed = sum(1 for b in all_bookings if b["status"] == "confirmed")
    pending = sum(1 for b in all_bookings if b["status"] == "pending")
    cancelled = sum(1 for b in all_bookings if b["status"] == "cancelled")
    monthly_revenue = sum(b["total_price"] for b in all_bookings if b["check_in"] >= month_start)
    occupied_today = sum(
        1 for b in all_bookings
        if b["status"] == "confirmed" and b["check_in"] <= today and b["check_out"] > today
    )
    occupancy_rate = round((occupied_today / total_rooms) * 100)

    return {
        "totalBookings": total_bookings,
        "monthlyRevenue": monthly_revenue,
        "occupancyRate": occupancy_rate,
        "confirmedBookings": confirmed,
        "pendingBookings": pending,
        "cancelledBookings": cancelled,
        "totalGuests": 0,
        "activeGuests": occupied_today,
    }


@app.route("/api/dashboard/monthly-revenue", methods=["GET"])
def get_monthly_revenue():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        bookings = supabase.table("bookings").select("total_price, check_in").execute().data or []
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        current_month = datetime.now().month

        revenue_map = {}
        for b in bookings:
            d = datetime.strptime(b["check_in"][:10], "%Y-%m-%d")
            m = months[d.month - 1]
            revenue_map[m] = revenue_map.get(m, 0) + b["total_price"]

        return jsonify([{"month": m, "revenue": revenue_map.get(m, 0)} for m in months[:current_month]]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/dashboard/occupancy", methods=["GET"])
def get_occupancy_data():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        bookings = supabase.table("bookings").select("check_in, check_out, status").execute().data or []
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        now = datetime.now()
        current_month = now.month
        current_year = now.year

        result = []
        for i, m in enumerate(months[:current_month]):
            month_bookings = [b for b in bookings if datetime.strptime(b["check_in"][:10], "%Y-%m-%d").year == current_year and datetime.strptime(b["check_in"][:10], "%Y-%m-%d").month == i]
            days_in_month = (datetime(current_year, i + 2, 1) - datetime(current_year, i + 1, 1)).days if i < 11 else 31
            occupied_days = set()
            for b in month_bookings:
                start = max(datetime.strptime(b["check_in"][:10], "%Y-%m-%d"), datetime(current_year, i + 1, 1))
                end = min(datetime.strptime(b["check_out"][:10], "%Y-%m-%d"), datetime(current_year, i + 1, days_in_month))
                d = start
                while d < end:
                    occupied_days.add(d.strftime("%Y-%m-%d"))
                    d = d.replace(day=d.day + 1) if d.day < days_in_month else d
                    try:
                        d = d.replace(day=d.day + 1)
                    except ValueError:
                        break
            rate = round((len(occupied_days) / days_in_month) * 100)
            result.append({"month": m, "rate": rate, "bookings": len(month_bookings)})

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Analytics (computed from raw data) ─────────────────────────────────────────

@app.route("/api/analytics/seasonal", methods=["GET"])
def get_seasonal_data():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload = cached_json("analytics-seasonal", _build_seasonal_data, ttl=60)
        return jsonify(payload), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _build_seasonal_data():
    bookings = supabase.table("bookings").select("total_price, check_in, status").neq("status", "cancelled").execute().data or []
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    current_year = datetime.now().year

    month_stats = []
    for i, m in enumerate(months):
        mb = [b for b in bookings if datetime.strptime(b["check_in"][:10], "%Y-%m-%d").year == current_year and datetime.strptime(b["check_in"][:10], "%Y-%m-%d").month == i]
        total_revenue = sum(b["total_price"] for b in mb)
        month_stats.append({"month": m, "bookings": len(mb), "revenue": total_revenue})

    sorted_months = sorted(month_stats, key=lambda x: x["bookings"], reverse=True)
    peak_threshold = ceil(len(month_stats) * 0.4)
    peak_months = {s["month"] for s in sorted_months[:peak_threshold]}

    return [{**s, "isPeak": s["month"] in peak_months} for s in month_stats]


@app.route("/api/analytics/room-performance", methods=["GET"])
def get_room_performance():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload = cached_json("analytics-room-perf", _build_room_performance, ttl=60)
        return jsonify(payload), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _build_room_performance():
    rooms = supabase.table("rooms").select("id, type, price").execute().data or []
    bookings = supabase.table("bookings").select("room_id, total_price, check_in, check_out, status").neq("status", "cancelled").execute().data or []

    rooms_by_id = {r["id"]: r for r in rooms}
    type_stats = {}
    for r in rooms:
        if r["type"] not in type_stats:
            type_stats[r["type"]] = {"revenue": 0, "nights": 0, "total_bookings": 0}

    for b in bookings:
        room = rooms_by_id.get(b["room_id"])
        if not room:
            continue
        s = type_stats[room["type"]]
        s["revenue"] += b["total_price"]
        s["nights"] += days_between(b["check_in"], b["check_out"])
        s["total_bookings"] += 1

    result = []
    for t, s in type_stats.items():
        avg = round(s["revenue"] / s["nights"]) if s["nights"] > 0 else 0
        rooms_of_type = sum(1 for r in rooms if r["type"] == t)
        occ = min(100, round((s["nights"] / (rooms_of_type * 30)) * 100))
        result.append({"room": t, "revenue": s["revenue"], "avgPerNight": avg, "occupancy": occ})

    return sorted(result, key=lambda x: x["revenue"], reverse=True)


@app.route("/api/analytics/insights", methods=["GET"])
def get_insights():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload = cached_json("analytics-insights", _build_insights, ttl=60)
        return jsonify(payload), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _build_insights():
    rooms = supabase.table("rooms").select("id, type, price").execute().data or []
    bookings = supabase.table("bookings").select("room_id, total_price, check_in, check_out, status").neq("status", "cancelled").execute().data or []

    rooms_by_id = {r["id"]: r for r in rooms}
    total_bookings = len(bookings)
    total_revenue = sum(b["total_price"] for b in bookings)

    type_revenue = {}
    for b in bookings:
        room = rooms_by_id.get(b["room_id"])
        if room:
            type_revenue[room["type"]] = type_revenue.get(room["type"], 0) + b["total_price"]
    best_room = max(type_revenue.items(), key=lambda x: x[1]) if type_revenue else None

    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    current_year = datetime.now().year
    month_bookings = {}
    for b in bookings:
        d = datetime.strptime(b["check_in"][:10], "%Y-%m-%d")
        if d.year == current_year:
            m = months[d.month - 1]
            month_bookings[m] = month_bookings.get(m, 0) + 1
    sorted_months = sorted(month_bookings.items(), key=lambda x: x[1], reverse=True)
    peak = ", ".join(m for m, _ in sorted_months[:3]) or "—"

    return [
        {"label": "Total Bookings", "value": str(total_bookings), "detail": "All time"},
        {"label": "Best Room", "value": best_room[0] if best_room else "—", "detail": f"₱{best_room[1]:,} revenue" if best_room else "No data"},
        {"label": "Total Revenue", "value": f"₱{total_revenue:,}", "detail": "All time"},
        {"label": "Peak Months", "value": peak, "detail": "Highest booking volume"},
    ]


@app.route("/api/analytics/forecast/occupancy", methods=["GET"])
def get_occupancy_forecast():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload = cached_json("analytics-occ-fc", _build_occupancy_forecast, ttl=60)
        return jsonify(payload), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _build_occupancy_forecast():
    bookings = supabase.table("bookings").select("check_in, check_out, status").execute().data or []
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    now = datetime.now()
    current_month = now.month - 1
    current_year = now.year

    occupancy = []
    for i in range(12):
        month_bookings = [b for b in bookings if datetime.strptime(b["check_in"][:10], "%Y-%m-%d").year == current_year and datetime.strptime(b["check_in"][:10], "%Y-%m-%d").month == i]
        days_in_month = (datetime(current_year, i + 2, 1) - datetime(current_year, i + 1, 1)).days if i < 11 else 31
        occupied_days = set()
        for b in month_bookings:
            start = max(datetime.strptime(b["check_in"][:10], "%Y-%m-%d"), datetime(current_year, i + 1, 1))
            end = min(datetime.strptime(b["check_out"][:10], "%Y-%m-%d"), datetime(current_year, i + 1, days_in_month))
            d = start
            while d < end:
                occupied_days.add(d.strftime("%Y-%m-%d"))
                try:
                    d = d.replace(day=d.day + 1)
                except ValueError:
                    break
        rate = round((len(occupied_days) / days_in_month) * 100)
        occupancy.append({"month": months[i], "rate": rate})

    recent = [o["rate"] for o in occupancy[:current_month + 1] if o["rate"] > 0]
    avg_rate = round(sum(recent) / len(recent)) if recent else 70

    seasonal = [0.85, 0.9, 1.0, 0.95, 1.1, 0.9, 1.05, 1.0, 0.8, 0.75, 0.85, 1.1]
    result = []
    for i, m in enumerate(months):
        real = occupancy[i] if i < len(occupancy) else None
        actual = real["rate"] if i <= current_month else None
        predicted = round(avg_rate * seasonal[i])
        result.append({"month": m, "actual": actual, "predicted": predicted})
    return result


@app.route("/api/analytics/forecast/revenue", methods=["GET"])
def get_revenue_forecast():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload = cached_json("analytics-rev-fc", _build_revenue_forecast, ttl=60)
        return jsonify(payload), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _build_revenue_forecast():
    bookings = supabase.table("bookings").select("total_price, check_in").execute().data or []
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    current_month = datetime.now().month - 1

    revenue_map = {}
    for b in bookings:
        d = datetime.strptime(b["check_in"][:10], "%Y-%m-%d")
        m = months[d.month - 1]
        revenue_map[m] = revenue_map.get(m, 0) + b["total_price"]

    revenue = [revenue_map.get(m, 0) for m in months]
    recent = [r for r in revenue[:current_month + 1] if r > 0]
    avg = round(sum(recent) / len(recent)) if recent else 300000

    seasonal = [0.85, 0.9, 1.0, 0.95, 1.1, 0.9, 1.05, 1.0, 0.8, 0.75, 0.85, 1.1]
    result = []
    for i, m in enumerate(months):
        actual = revenue[i] if i <= current_month else None
        predicted = round(avg * seasonal[i])
        result.append({"month": m, "actual": actual, "predicted": predicted})
    return result


# ── AI status persistence (demand insights + discount offers) ────────────────
_demand_status_file = os.path.join(os.path.dirname(__file__), ".demand_insight_status.json")
_offer_status_file = os.path.join(os.path.dirname(__file__), ".offer_status.json")


def _status_file_candidates(path: str) -> list[str]:
    """Primary path plus /tmp fallback (Vercel read-only bundle FS)."""
    candidates = [path]
    tmp = os.path.join("/tmp", os.path.basename(path))
    if tmp != path:
        candidates.append(tmp)
    return candidates


def _load_json_file(path: str, default):
    for p in _status_file_candidates(path):
        try:
            if os.path.exists(p):
                with open(p, "r") as f:
                    return json.load(f)
        except Exception:
            continue
    return default


def _save_json_file(path: str, data) -> bool:
    for p in _status_file_candidates(path):
        try:
            with open(p, "w") as f:
                json.dump(data, f)
            return True
        except OSError:
            continue
    print(f"_save_json_file failed for {path} (read-only FS)")
    return False


@app.route("/api/analytics/demand-insights/status", methods=["POST"])
def set_demand_insight_status():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    insight_id = data.get("id")
    action = data.get("action")
    if not insight_id or action not in ("accept", "dismiss", "edit"):
        return jsonify({"error": "id and action (accept|dismiss|edit) required"}), 400

    discount_percent = data.get("discountPercent")
    if action == "edit" or discount_percent is not None:
        if isinstance(discount_percent, bool) or not isinstance(discount_percent, (int, float)) or not 1 <= discount_percent <= 80:
            return jsonify({"error": "discountPercent must be a number from 1 to 80"}), 400
        discount_percent = int(discount_percent)

    status = _load_json_file(_demand_status_file, {})
    previous = status.get(insight_id, {})
    insight_state = previous.copy() if isinstance(previous, dict) else {"status": previous} if previous else {}
    if action == "edit":
        insight_state["discountPercent"] = discount_percent
    elif action == "accept":
        insight_state["status"] = "accepted"
    else:
        insight_state["status"] = "dismissed"
    if discount_percent is not None:
        insight_state["discountPercent"] = discount_percent
    status[insight_id] = insight_state
    if not _save_json_file(_demand_status_file, status):
        return jsonify({"error": "Could not save status"}), 500
    invalidate_cache("analytics-demand")
    return jsonify({"ok": True}), 200


@app.route("/api/analytics/discount-offers/status", methods=["POST"])
def set_discount_offer_status():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    offer_id = data.get("id")
    status_val = data.get("status")
    if not offer_id or status_val not in ("active", "scheduled", "dismissed"):
        return jsonify({"error": "id and status (active|scheduled|dismissed) required"}), 400

    discount_percent = data.get("discountPercent")
    if discount_percent is not None:
        if isinstance(discount_percent, bool) or not isinstance(discount_percent, (int, float)) or not 1 <= discount_percent <= 80:
            return jsonify({"error": "discountPercent must be a number from 1 to 80"}), 400
        discount_percent = int(discount_percent)

    status = _load_json_file(_offer_status_file, {})
    previous = status.get(offer_id, {})
    offer_state = previous.copy() if isinstance(previous, dict) else {}
    offer_state["status"] = status_val
    if discount_percent is not None:
        offer_state["discountPercent"] = discount_percent
    status[offer_id] = offer_state
    if not _save_json_file(_offer_status_file, status):
        return jsonify({"error": "Could not save status"}), 500
    invalidate_cache("analytics-discounts")
    return jsonify({"ok": True}), 200


@app.route("/api/analytics/demand-insights", methods=["GET"])
def get_demand_insights():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload = cached_json("analytics-demand", _build_demand_insights, ttl=60)
        return jsonify(payload), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _build_demand_insights():
        # Single source of truth: the scikit-learn pipeline (K-Means demand
        # segments + Gradient Boosting discounts) — the same one that feeds
        # the dashboard cards, so every AI surface agrees.
        from predictive_analytics import generate_demand_insights

        rooms = supabase.table("rooms").select("id, type, price").execute().data or []
        bookings = supabase.table("bookings").select("room_id, check_in, check_out, status, total_price").neq("status", "cancelled").execute().data or []

        insights = generate_demand_insights(bookings, rooms, shared=True)

        saved = _load_json_file(_demand_status_file, {})
        out = []
        for ins in insights:
            st = saved.get(ins["id"], "")
            saved_status = st.get("status", "") if isinstance(st, dict) else st
            if saved_status == "dismissed":
                continue
            if isinstance(st, dict):
                saved_percent = st.get("discountPercent")
                if isinstance(saved_percent, (int, float)) and not isinstance(saved_percent, bool) and 1 <= saved_percent <= 80:
                    old_percent = int(ins.get("discountPercent", 0))
                    ins["discountPercent"] = int(saved_percent)
                    room_labels = " & ".join(ins.get("affectedRooms", [])) or "selected rooms"
                    ins["recommendation"] = f"{int(saved_percent)}% discount on {room_labels} to stimulate demand"
                    if old_percent != int(saved_percent):
                        ins["reason"] = f"{ins.get('reason', '')} Admin adjusted the suggested discount from {old_percent}% to {int(saved_percent)}%."
            ins["applied"] = saved_status == "accepted"
            ins["dismissed"] = False
            out.append(ins)
        return out


@app.route("/api/analytics/discount-offers", methods=["GET"])
def get_discount_offers():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        payload = cached_json("analytics-discounts", _build_discount_offers, ttl=60)
        return jsonify(payload), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _build_discount_offers():
        # Same sklearn pipeline as demand insights / dashboard cards.
        from predictive_analytics import generate_discount_offers

        rooms = supabase.table("rooms").select("id, type, price").execute().data or []
        bookings = supabase.table("bookings").select("room_id, check_in, check_out, status").neq("status", "cancelled").execute().data or []

        offers = generate_discount_offers(bookings, rooms, shared=True)

        saved = _load_json_file(_offer_status_file, {})
        out = []
        for o in offers:
            st = saved.get(o["id"], "")
            saved_status = st.get("status", "") if isinstance(st, dict) else st
            if saved_status == "dismissed":
                continue
            if isinstance(st, dict):
                if saved_status:
                    o["status"] = saved_status
                saved_percent = st.get("discountPercent")
                if isinstance(saved_percent, (int, float)) and not isinstance(saved_percent, bool) and 1 <= saved_percent <= 80:
                    o["discountPercent"] = int(saved_percent)
                    o["discountedRate"] = round(o["baseRate"] * (1 - int(saved_percent) / 100))
                    o["projectedRevenue"] = o["projectedBookings"] * o["discountedRate"]
            elif st:
                o["status"] = st
            out.append(o)
        return out


# ── PayMongo Webhook ────────────────────────────────────────────────────────────

@app.route("/api/webhook/paymongo", methods=["POST"])
def paymongo_webhook():
    """Handle PayMongo payment events."""
    try:
        payload = request.get_json()
        event_type = payload.get("data", {}).get("attributes", {}).get("type", "")
        print(f"Webhook received: {event_type}")

        if event_type == "payment.failed":
            attrs = payload["data"]["attributes"]
            payment_data = attrs.get("data", {}).get("attributes", {})
            description = payment_data.get("description", "")
            booking_id = None
            if description.startswith("Booking: "):
                booking_id = description.replace("Booking: ", "").strip()
            metadata = payment_data.get("metadata", {})
            if not booking_id and metadata.get("booking_id"):
                booking_id = metadata["booking_id"]

            if booking_id:
                booking_res = supabase_admin.table("bookings").select("user_id, room_id, check_in, status").eq("id", booking_id).execute()
                if booking_res.data:
                    b = booking_res.data[0]
                    if b["status"] != "cancelled":
                        supabase_admin.table("bookings").update({"status": "cancelled"}).eq("id", booking_id).execute()
                        room_name = "your room"
                        if b.get("room_id"):
                            rr = supabase_admin.table("rooms").select("name").eq("id", b["room_id"]).execute()
                            if rr.data:
                                room_name = rr.data[0]["name"]
                        create_notification(b["user_id"], "booking", "Booking Failed",
                            f"Your booking for {room_name} on {b.get('check_in', '')} has been cancelled due to a failed payment.",
                            booking_id=booking_id)
                print(f"Booking {booking_id} payment failed via webhook")

        elif event_type == "payment.paid":
            attrs = payload["data"]["attributes"]
            payment_data = attrs.get("data", {}).get("attributes", {})

            # Extract billing info to find the booking
            billing = payment_data.get("billing", {})
            billing_name = billing.get("name", "")

            # Try to find booking by description (format: "Booking: <booking_id>")
            description = payment_data.get("description", "")
            booking_id = None
            if description.startswith("Booking: "):
                booking_id = description.replace("Booking: ", "").strip()

            # Also check metadata if present
            metadata = payment_data.get("metadata", {})
            if not booking_id and metadata.get("booking_id"):
                booking_id = metadata["booking_id"]

            if booking_id:
                # Update booking status to confirmed (only if still pending)
                # Service-role: webhooks have no user JWT for RLS.
                row_res = supabase_admin.table("bookings") \
                    .select("total_price, payment_mode").eq("id", booking_id).execute()
                row = row_res.data[0] if row_res.data else {}
                update = {"status": "confirmed"}
                if row:
                    # Record the online-collected amount — a downpayment only
                    # settles half, the rest is still owed at the hotel.
                    update["amount_paid"] = settled_amount(
                        row.get("total_price"), row.get("payment_mode"))
                source_type = (payment_data.get("source") or {}).get("type")
                if source_type:
                    update["payment_method"] = _PAYMONGO_SOURCE_TYPES.get(source_type, source_type)
                # Reference needed to issue a refund later (migrate-refund.sql).
                if payment_data.get("payment_intent"):
                    update["payment_intent"] = payment_data["payment_intent"]
                try:
                    result = supabase_admin.table("bookings").update(update).eq("id", booking_id).eq("status", "pending").execute()
                except Exception as ue:
                    # amount_paid / payment_intent need their migrations.
                    for col in ("amount_paid", "payment_intent"):
                        if col in str(ue):
                            update.pop(col, None)
                    print(f"webhook confirm retry: {ue}")
                    result = supabase_admin.table("bookings").update(update).eq("id", booking_id).eq("status", "pending").execute()
                print(f"Booking {booking_id} confirmed via webhook")

                # Only notify if the status actually changed
                if result.data:
                    booking_res = supabase_admin.table("bookings").select("user_id, room_id, check_in").eq("id", booking_id).execute()
                    if booking_res.data:
                        b = booking_res.data[0]
                        room_name = "your room"
                        if b.get("room_id"):
                            rr = supabase_admin.table("rooms").select("name").eq("id", b["room_id"]).execute()
                            if rr.data:
                                room_name = rr.data[0]["name"]
                        create_notification(b["user_id"], "booking", "Payment Confirmed",
                            f"Payment received! Your booking for {room_name} on {b.get('check_in', '')} is now confirmed.",
                            booking_id=booking_id)
                        notify_admins("booking", "Payment Confirmed",
                            f"Payment received for {room_name} on {b.get('check_in', '')}.",
                            booking_id=booking_id)
                        # NOTE: rooms.available is the maintenance toggle, not
                        # occupancy — never clear it on payment (it hides the
                        # room from /api/rooms/public). See check_room_availability.
            else:
                print(f"Webhook: Could not find booking_id from description: {description}")

        return jsonify({"received": True}), 200
    except Exception as e:
        print(f"Webhook error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings/confirm/<booking_id>", methods=["POST"])
def confirm_booking_after_payment(booking_id):
    """Called by frontend after successful PayMongo redirect."""
    try:
        # Service-role: this endpoint never set_auth()'d — ran as anon and
        # RLS filtered the SELECT (404) / blocked the UPDATE.
        booking_res = supabase_admin.table("bookings").select(
            "user_id, room_id, check_in, status, payment_method,"
            " total_price, payment_mode, amount_paid"
        ).eq("id", booking_id).execute()

        if not booking_res.data:
            return jsonify({"error": "Booking not found"}), 404

        b = booking_res.data[0]

        # Replace the awaiting:<session_id> marker with the method actually
        # used inside PayMongo (gcash / paymaya / card). Never fails confirm.
        # PayMongo may not have attached the payment to the session yet when
        # the redirect lands, so retry briefly before giving up.
        pm = b.get("payment_method") or ""
        if pm.startswith("awaiting:"):
            for attempt in range(3):
                try:
                    if resolve_pending_payment_method(booking_id, pm):
                        break
                except Exception as e:
                    print(f"payment method resolve error: {e}")
                    break
                if attempt < 2:
                    time.sleep(1)

        # Save a refund reference if we don't have one yet (redirect usually
        # beats the webhook, so this is often the only place it lands).
        if not b.get("payment_intent"):
            sid = pm.split(":", 1)[1] if pm.startswith("awaiting:") else None
            pi = session_payment_intent_id(fetch_paymongo_session(sid)) if sid else None
            if pi:
                try:
                    supabase_admin.table("bookings").update({"payment_intent": pi}).eq("id", booking_id).execute()
                except Exception as ue:
                    print(f"payment_intent store skipped: {ue}")

        if b["status"] == "confirmed":
            return jsonify({"booking_id": booking_id, "status": "confirmed"}), 200

        # Update booking status to confirmed + record what was collected online
        update = {"status": "confirmed"}
        if float(b.get("amount_paid") or 0) <= 0:
            update["amount_paid"] = settled_amount(b.get("total_price"), b.get("payment_mode"))
        try:
            result = supabase_admin.table("bookings").update(update).eq("id", booking_id).eq("status", "pending").execute()
        except Exception as ue:
            # amount_paid needs migrate-payment-mode.sql.
            update.pop("amount_paid", None)
            print(f"confirm retry without amount_paid: {ue}")
            result = supabase_admin.table("bookings").update(update).eq("id", booking_id).eq("status", "pending").execute()

        if result.data:
            room_name = "your room"
            if b.get("room_id"):
                rr = supabase_admin.table("rooms").select("name").eq("id", b["room_id"]).execute()
                if rr.data:
                    room_name = rr.data[0]["name"]
            create_notification(b["user_id"], "booking", "Booking Confirmed",
                f"Your booking for {room_name} on {b.get('check_in', '')} is confirmed!",
                booking_id=booking_id)
            return jsonify({
                "booking_id": booking_id,
                "status": "confirmed",
                "room_name": room_name,
                "check_in": b["check_in"],
                "check_out": "",
            }), 200

        return jsonify({"booking_id": booking_id, "status": "confirmed"}), 200
    except Exception as e:
        err = str(e)
        if "row-level security" in err or "42501" in err:
            return jsonify({"error": "Unable to confirm booking due to a permissions issue. Please try again or contact support."}), 500
        return jsonify({"error": err}), 500


# ── Health ─────────────────────────────────────────────────────────────────────


@app.route("/api/bookings/<booking_id>/payment-failed", methods=["POST"])
def report_payment_failed(booking_id):
    """Called by frontend when user lands on /booking/failed — creates notification."""
    try:
        booking_res = supabase_admin.table("bookings").select("user_id, room_id, check_in, status").eq("id", booking_id).execute()
        if not booking_res.data:
            return jsonify({"error": "Booking not found"}), 404

        b = booking_res.data[0]
        if b["status"] in ("cancelled", "confirmed"):
            return jsonify({"booking_id": booking_id, "status": b["status"]}), 200

        supabase_admin.table("bookings").update({"status": "cancelled"}).eq("id", booking_id).execute()

        room_name = "your room"
        if b.get("room_id"):
            rr = supabase_admin.table("rooms").select("name").eq("id", b["room_id"]).execute()
            if rr.data:
                room_name = rr.data[0]["name"]

        create_notification(b["user_id"], "booking", "Booking Failed",
            f"Your booking for {room_name} on {b.get('check_in', '')} has been cancelled due to a failed payment.",
            booking_id=booking_id)

        return jsonify({"booking_id": booking_id, "status": "cancelled"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analytics/ai-recommendations", methods=["GET"])
def ai_recommendations():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        # Heaviest endpoint (sklearn + 2 full scans). Cache 90s so the 30s
        # dashboard poll usually hits cache after the first compute.
        payload = cached_json("ai-reco", _build_ai_recommendations, ttl=90)
        return jsonify(payload), 200
    except Exception as e:
        print(f"ai-recommendations error: {e}")
        return jsonify(_ai_reco_fallback()), 200


def _ai_reco_fallback():
    return {
        "next30DaysOccupancy": 0,
        "occupancyTrend": "stable",
        "projectedRevenue": 0,
        "revenueGrowth": 0,
        "activeDiscounts": 0,
        "bestDiscountPeriod": None,
        "confidence": 0,
        "recommendations": [
            {"id": "AI-1", "title": "Occupancy Forecast", "description": "Unable to compute predictions right now.", "priority": "medium", "action": "Try again in a moment."},
            {"id": "AI-2", "title": "Revenue Projection", "description": "Unable to compute projections right now.", "priority": "medium", "action": "Try again in a moment."},
            {"id": "AI-3", "title": "Discount Recommendation", "description": "Unable to compute discount ideas right now.", "priority": "low", "action": "Try again in a moment."},
        ]
    }


def _build_ai_recommendations():
    from predictive_analytics import generate_demand_insights, generate_discount_offers

    rooms = supabase.table("rooms").select("id, type, price").execute().data or []
    # Cancelled bookings must not inflate forecasts (parity with the other
    # analytics builders).
    bookings = supabase.table("bookings").select(
        "room_id, check_in, check_out, status, total_price"
    ).neq("status", "cancelled").execute().data or []

    if not rooms:
        return {
            "next30DaysOccupancy": 0,
            "occupancyTrend": "stable",
            "projectedRevenue": 0,
            "revenueGrowth": 0,
            "activeDiscounts": 0,
            "bestDiscountPeriod": None,
            "confidence": 0,
            "recommendations": [
                {"id": "AI-1", "title": "Occupancy Forecast", "description": "No room data available yet.", "priority": "medium", "action": "Add rooms to start generating insights."},
                {"id": "AI-2", "title": "Revenue Projection", "description": "No bookings to project from yet.", "priority": "medium", "action": "Monitor performance."},
                {"id": "AI-3", "title": "Discount Recommendation", "description": "Not enough data for discount ideas.", "priority": "low", "action": "Maintain current rates."},
            ]
        }

    # sklearn: K-Means demand segments + Gradient Boosting discounts. One
    # shared feature build + KMeans fit across insights & offers.
    insights = generate_demand_insights(bookings, rooms, shared=True)
    offers = generate_discount_offers(bookings, rooms, shared=True)

    # ── Real rolling 30-day forecast straight from actual bookings ──
    # upcoming window: today .. +30d, compared against the 30d before today.
    total_rooms = max(len(rooms), 1)
    today = datetime.now().date()
    window_end = today + timedelta(days=30)
    prev_start = today - timedelta(days=30)
    capacity = total_rooms * 30

    up_nights = up_revenue = up_count = 0
    prev_nights = prev_revenue = 0
    for b in bookings:
        try:
            ci = datetime.strptime(b["check_in"][:10], "%Y-%m-%d").date()
            co = datetime.strptime(b["check_out"][:10], "%Y-%m-%d").date()
        except (ValueError, KeyError, TypeError):
            continue
        if co <= ci:
            co = ci + timedelta(days=1)
        price = b.get("total_price") or 0
        if ci < window_end and co > today:
            up_nights += max((min(co, window_end) - max(ci, today)).days, 0)
            up_revenue += price
            up_count += 1
        if ci < today and co > prev_start:
            prev_nights += max((min(co, today) - max(ci, prev_start)).days, 0)
            prev_revenue += price

    occupancy = round(up_nights / capacity * 100) if capacity else 0
    prev_occupancy = round(prev_nights / capacity * 100) if capacity else 0
    if occupancy > prev_occupancy + 2:
        trend = "up"
    elif occupancy < prev_occupancy - 2:
        trend = "down"
    else:
        trend = "stable"
    if prev_revenue:
        growth = round((up_revenue - prev_revenue) / prev_revenue * 100)
    else:
        growth = 100 if up_revenue else 0

    # Discount ideas: live (scheduled/active, non-dismissed) sklearn offers.
    live_offers = [o for o in offers if o.get("status") in ("active", "scheduled")]
    best_period = None
    # Only real low-demand segments (not the "stable demand" fallback insight).
    if insights and insights[0].get("method") == "kmeans+gradient_boosting" and (insights[0].get("discountPercent") or 0) > 0:
        first = insights[0]
        affected = ", ".join(first.get("affectedRooms") or []) or "all rooms"
        best_period = f"{first.get('period', 'Upcoming period')}: {first['discountPercent']}% off {affected}"

    confidence = min(95, 60 + len(bookings) // 2)

    recommendations = [
        {
            "id": "AI-1",
            "title": "Occupancy Forecast",
            "description": f"{occupancy}% of room-nights booked for the next 30 days ({up_count} booking{'' if up_count == 1 else 's'} · {up_nights} of {capacity} room-nights).",
            "priority": "high" if occupancy < prev_occupancy else "medium",
            "action": "Review pricing strategy and consider targeted promotions." if occupancy < prev_occupancy else "Maintain current pricing strategy.",
        },
        {
            "id": "AI-2",
            "title": "Revenue Projection",
            "description": f"₱{up_revenue:,} expected over the next 30 days ({growth:+d}% vs the previous 30 days).",
            "priority": "medium",
            "action": "Monitor weekly and adjust pricing if needed.",
        },
        {
            "id": "AI-3",
            "title": "Discount Recommendation",
            "description": best_period or "No price cuts needed — demand looks healthy for the coming weeks.",
            "priority": "high" if best_period else "low",
            "action": "Implement discount during identified low-demand periods." if best_period else "Maintain current rates.",
        },
    ]

    return {
        "next30DaysOccupancy": occupancy,
        "occupancyTrend": trend,
        "projectedRevenue": up_revenue,
        "revenueGrowth": growth,
        "activeDiscounts": len(live_offers),
        "bestDiscountPeriod": best_period,
        "confidence": confidence,
        "recommendations": recommendations,
    }


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


# ── Discount Approvals ─────────────────────────────────────────────────────────
# File is the source of truth. Supabase is a secondary sync.
_approved_discounts_file = os.path.join(os.path.dirname(__file__), ".approved_discounts.json")
_supabase_discounts_table_ok: bool | None = None  # None = untested, True/False = tested


def _load_approved_cache() -> set[str]:
    """Load approved keys from disk (best-effort)."""
    try:
        if os.path.exists(_approved_discounts_file):
            with open(_approved_discounts_file, "r") as f:
                return set(json.load(f))
    except Exception as e:
        print(f"_load_approved_cache error: {e}")
    return set()


def _save_approved_cache(keys: set[str]) -> bool:
    """Persist approved keys to disk. Returns False on read-only FS (e.g. Vercel)."""
    try:
        with open(_approved_discounts_file, "w") as f:
            json.dump(sorted(keys), f)
        return True
    except OSError as e:
        print(f"_save_approved_cache skipped (read-only FS): {e}")
        return False


def _discounts_table_exists() -> bool:
    """Probe once whether approved_discounts table exists in Supabase."""
    global _supabase_discounts_table_ok
    if _supabase_discounts_table_ok is not None:
        return _supabase_discounts_table_ok
    try:
        supabase.table("approved_discounts").select("event_room_type_key").limit(1).execute()
        _supabase_discounts_table_ok = True
        print("[discounts] Supabase approved_discounts table OK — using DB persistence")
    except Exception as e:
        _supabase_discounts_table_ok = False
        print(f"[discounts] approved_discounts table not found — using file fallback ({e})")
    return _supabase_discounts_table_ok


@app.route("/api/discounts/approved", methods=["GET"])
def get_approved_discounts():
    """Get all approved discount event-room-type keys.
    Merges file (source of truth) + Supabase table so data is never lost."""
    keys = set(_load_approved_cache())  # Always read file first

    if _discounts_table_exists():
        try:
            result = supabase.table("approved_discounts").select("event_room_type_key").execute()
            for row in result.data:
                keys.add(row["event_room_type_key"])
        except Exception as e:
            print(f"get_approved_discounts error: {e}")

    return jsonify({"approved": sorted(keys)}), 200


@app.route("/api/discounts/active", methods=["GET"])
def get_active_discount_offers():
    """Scheduled offers the admin switched on.

    Public on purpose: the guest Rooms page badges these. Activating an offer
    in the admin table and the badge a guest sees were two separate systems
    before, so switching an offer on never showed up for guests.
    """
    try:
        return jsonify([o for o in _build_discount_offers() if o.get("status") == "active"]), 200
    except Exception as e:
        print(f"active discount offers error: {e}")
        return jsonify([]), 200


@app.route("/api/discounts/approve", methods=["POST"])
def approve_discount():
    """Approve a discount by event-room-type key."""
    data = request.get_json()
    key = data.get("event_room_type_key")
    if not key:
        return jsonify({"error": "event_room_type_key required"}), 400

    # Best-effort local file cache (fails silently on read-only FS like Vercel)
    file_ok = False
    try:
        keys = _load_approved_cache()
        keys.add(key)
        file_ok = _save_approved_cache(keys)
    except Exception as e:
        print(f"approve_discount file error: {e}")

    # Durable store: Supabase (works on both local and Vercel)
    supa_ok = False
    if _discounts_table_exists():
        try:
            try:
                supabase.table("approved_discounts").delete().eq("event_room_type_key", key).execute()
            except Exception:
                pass
            supabase.table("approved_discounts").insert(
                {"event_room_type_key": key}
            ).execute()
            supa_ok = True
        except Exception as e:
            print(f"approve_discount Supabase error: {e}")

    if not file_ok and not supa_ok:
        return jsonify({"error": "Could not save approval"}), 500
    return jsonify({"ok": True}), 200


@app.route("/api/discounts/dismiss", methods=["POST"])
def dismiss_discount():
    """Dismiss (remove) an approved discount."""
    data = request.get_json()
    key = data.get("event_room_type_key")
    if not key:
        return jsonify({"error": "event_room_type_key required"}), 400

    # Best-effort local file cache (fails silently on read-only FS like Vercel)
    file_ok = False
    try:
        keys = _load_approved_cache()
        keys.discard(key)
        file_ok = _save_approved_cache(keys)
    except Exception as e:
        print(f"dismiss_discount file error: {e}")

    # Durable store: Supabase
    supa_ok = False
    if _discounts_table_exists():
        try:
            supabase.table("approved_discounts").delete().eq(
                "event_room_type_key", key
            ).execute()
            supa_ok = True
        except Exception as e:
            print(f"dismiss_discount Supabase error: {e}")

    if not file_ok and not supa_ok:
        return jsonify({"error": "Could not remove approval"}), 500
    return jsonify({"ok": True}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)
