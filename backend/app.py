from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY, PAYMONGO_SECRET_KEY, PAYMONGO_BASE_URL
from datetime import datetime, date, timedelta, timezone
from math import ceil
import os
import json
import re
import jwt as pyjwt
import uuid
import time
import requests as http_requests

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://hotel-ava-mcp.vercel.app",
    "https://hotelava.vercel.app",
]}})

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_SERVICE_KEY else supabase

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


def set_auth(token):
    """Set auth session on Supabase client so RLS policies work."""
    if token:
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
    global supabase
    try:
        supabase.postgrest.auth(None)
    except Exception:
        pass
    # Reset to a fresh anon client
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:
        pass


def get_user_from_token(token):
    """Decode JWT to get user ID. No DB query."""
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


# ── Notifications ────────────────────────────────────────────────────────────────

MAX_NOTIFICATIONS = 30


def create_notification(user_id, notif_type, title, message, booking_id=None):
    """Insert a notification and trim old ones to MAX_NOTIFICATIONS."""
    try:
        # Use the global supabase client (which has auth set via set_auth).
        # The anon-only client can't do writes — Supabase REST API requires
        # a valid Authorization header even when RLS policy is WITH CHECK (true).
        notif_data = {
            "user_id": user_id,
            "type": notif_type,
            "title": title,
            "message": message,
        }
        if booking_id:
            notif_data["booking_id"] = booking_id
        supabase.table("notifications").insert(notif_data).execute()

        # Trim to MAX_NOTIFICATIONS: keep newest, delete oldest
        all_notifs = supabase.table("notifications").select("id").eq("user_id", user_id).order("created_at", desc=True).execute()
        if all_notifs.data and len(all_notifs.data) > MAX_NOTIFICATIONS:
            old_ids = [n["id"] for n in all_notifs.data[MAX_NOTIFICATIONS:]]
            supabase.table("notifications").delete().in_("id", old_ids).execute()
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
        res = supabase_admin.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
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
        res = supabase_admin.table("notifications").select("id", count="exact").eq("user_id", user_id).eq("read", False).execute()
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
        frontend_url = os.getenv("FRONTEND_URL", "https://hotelava.vercel.app")
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
        res = supabase.auth.refresh_session(refresh)
        session = res.session
        user = res.user
        if not session or not user:
            return jsonify({"error": "Invalid refresh token"}), 401

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


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    if token:
        try:
            supabase.auth.sign_out()
        except Exception:
            pass
    return jsonify({"message": "Logged out successfully"}), 200


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

@app.route("/api/rooms/public", methods=["GET"])
def get_public_rooms():
    try:
        clear_auth()
        rooms_res = supabase.table("rooms").select("*").order("created_at", desc=True).execute()
        rooms = rooms_res.data or []

        result = []
        for r in rooms:
            if not r.get("available", True):
                continue
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

        frontend_url = os.getenv("FRONTEND_URL", "https://hotelava.vercel.app")
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


# ── Stay windows / extend helpers ──────────────────────────────────────────────

EXTEND_MAX_HOURS = 4
GAP_MINUTES = 60  # extending is blocked when the next booking is <= 1h away


def _now_naive():
    """UTC-naive now — same convention as auto_complete_bookings."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


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
            overlap_res = supabase.table("bookings").select("id, check_in, check_out").eq("room_id", room_id).in_("status", ["pending", "confirmed"]).or_(
                f"and(check_in.lt.{check_out},check_out.gt.{check_in})"
            ).execute()
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


@app.route("/api/bookings", methods=["POST"])
def create_booking():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    room_id = data.get("room_id")
    check_in = data.get("check_in")
    check_out = data.get("check_out")
    guests = data.get("guests", 1)
    full_name = data.get("full_name", "")
    email = data.get("email", "")
    phone = data.get("phone", "")
    special_requests = data.get("special_requests", "")
    payment_method = data.get("payment_method", "gcash")
    total_price = data.get("total_price", 0)
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
            overlap_res = supabase.table("bookings").select("id").eq("room_id", room_id).in_("status", ["pending", "confirmed"]).or_(
                f"and(check_in.lt.{check_out},check_out.gt.{check_in})"
            ).execute()
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
        }
        if stay_type == "day":
            booking_insert["duration"] = duration
            booking_insert["start_time"] = start_time
        elif stay_type == "overnight" and start_time:
            booking_insert["start_time"] = start_time

        # Service-role write: RLS on the shared anon client races with
        # clear_auth()/set_auth() from concurrent requests (42501).
        booking_res = supabase_admin.table("bookings").insert(booking_insert).execute()

        if not booking_res.data:
            return jsonify({"error": "Failed to create booking"}), 500

        booking = booking_res.data[0]
        booking_id = booking["id"]

        # Create PayMongo checkout session
        checkout_url, session_id = create_paymongo_checkout(
            booking_id=booking_id,
            amount=total_price,
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
                "total_price": b["total_price"],
                "status": b["status"],
                "payment_method": b.get("payment_method", ""),
                "created_at": b["created_at"],
                "stay_type": b.get("stay_type", "overnight"),
                "stays": b.get("stays", "24 Hours"),
                "duration": b.get("duration"),
                "start_time": b.get("start_time"),
                "end_time": end_time,
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
            "total_price": b["total_price"],
            "status": b["status"],
            "full_name": b.get("full_name", ""),
            "email": b.get("email", ""),
            "phone": b.get("phone", ""),
            "special_requests": b.get("special_requests", ""),
            "payment_method": b.get("payment_method", ""),
            "created_at": b["created_at"],
            "stay_type": b.get("stay_type", "overnight"),
            "stays": b.get("stays", "24 Hours"),
            "duration": b.get("duration"),
            "start_time": b.get("start_time"),
            "end_time": end_time,
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
        booking_res = supabase.table("bookings").select("user_id, status").eq("id", booking_id).execute()
        if not booking_res.data:
            return jsonify({"error": "Booking not found"}), 404

        b = booking_res.data[0]
        if b["user_id"] != user_id:
            return jsonify({"error": "Forbidden"}), 403
        if b["status"] not in ("pending", "confirmed"):
            return jsonify({"error": "Booking cannot be cancelled"}), 400

        supabase_admin.table("bookings").update({"status": "cancelled"}).eq("id", booking_id).execute()
        create_notification(user_id, "booking", "Booking Cancelled",
            "Your booking has been cancelled successfully.",
            booking_id=booking_id)
        return jsonify({"status": "cancelled"}), 200
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
            })

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/bookings/auto-complete", methods=["POST"])
def auto_complete_bookings():
    """Auto-complete confirmed bookings past their end, and auto-cancel unpaid bookings past their date."""
    import re as _re
    from datetime import datetime, timezone

    try:
        now = datetime.now(timezone.utc)
        today_s = now.strftime("%Y-%m-%d")
        current_time_minutes = now.hour * 60 + now.minute

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

        completed_ids = []
        for b in confirmed:
            should_complete = False
            stay_type = b.get("stay_type", "overnight")

            if stay_type == "day":
                start_time = b.get("start_time")
                duration = b.get("duration")
                check_in = b.get("check_in", "")
                if start_time and duration and check_in == today_s:
                    match = _re.match(r"(\d+):00\s*(AM|PM)", start_time, _re.IGNORECASE)
                    if match:
                        h = int(match.group(1))
                        period = match.group(2).upper()
                        if period == "PM" and h != 12:
                            h += 12
                        if period == "AM" and h == 12:
                            h = 0
                        start_minutes = h * 60
                        end_minutes = start_minutes + (duration * 60)
                        if current_time_minutes >= end_minutes:
                            should_complete = True
            else:
                check_out = b.get("check_out", "")
                if check_out and check_out < today_s:
                    should_complete = True

            if should_complete:
                result = supabase_admin.table("bookings").update({"status": "completed"}).eq("id", b["id"]).eq("status", "confirmed").execute()
                # Only notify if the status actually changed (prevents duplicates on repeated calls)
                if result.data:
                    completed_ids.append(b["id"])
                    create_notification(b["user_id"], "booking", "Stay Completed",
                        f"Your stay at {room_name(b)} has been marked as completed. We hope to see you again!",
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

        return jsonify({"message": f"Booking status updated to {new_status}", "status": new_status}), 200
    except Exception as e:
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


def _load_json_file(path: str, default):
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            return default
    return default


def _save_json_file(path: str, data) -> None:
    with open(path, "w") as f:
        json.dump(data, f)


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
    if not insight_id or action not in ("accept", "dismiss"):
        return jsonify({"error": "id and action (accept|dismiss) required"}), 400

    status = _load_json_file(_demand_status_file, {})
    if action == "accept":
        status[insight_id] = "accepted"
    else:
        status[insight_id] = "dismissed"
    _save_json_file(_demand_status_file, status)
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

    status = _load_json_file(_offer_status_file, {})
    status[offer_id] = status_val
    _save_json_file(_offer_status_file, status)
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
            if st == "dismissed":
                continue
            ins["applied"] = st == "accepted"
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
            if st == "dismissed":
                continue
            if st:
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
                update = {"status": "confirmed"}
                source_type = (payment_data.get("source") or {}).get("type")
                if source_type:
                    update["payment_method"] = _PAYMONGO_SOURCE_TYPES.get(source_type, source_type)
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
                        room_id = b.get("room_id")
                        if room_id:
                            supabase_admin.table("rooms").update({"available": False}).eq("id", room_id).execute()
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
        booking_res = supabase_admin.table("bookings").select("user_id, room_id, check_in, status, payment_method").eq("id", booking_id).execute()

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

        if b["status"] == "confirmed":
            return jsonify({"booking_id": booking_id, "status": "confirmed"}), 200

        # Update booking status to confirmed
        result = supabase_admin.table("bookings").update({"status": "confirmed"}).eq("id", booking_id).eq("status", "pending").execute()

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
    """Load approved keys from disk."""
    if os.path.exists(_approved_discounts_file):
        with open(_approved_discounts_file, "r") as f:
            return set(json.load(f))
    return set()


def _save_approved_cache(keys: set[str]) -> None:
    """Persist approved keys to disk."""
    with open(_approved_discounts_file, "w") as f:
        json.dump(sorted(keys), f)


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


@app.route("/api/discounts/approve", methods=["POST"])
def approve_discount():
    """Approve a discount by event-room-type key."""
    data = request.get_json()
    key = data.get("event_room_type_key")
    if not key:
        return jsonify({"error": "event_room_type_key required"}), 400

    # Always save to file (source of truth)
    keys = _load_approved_cache()
    keys.add(key)
    _save_approved_cache(keys)

    # Also try Supabase (best effort)
    if _discounts_table_exists():
        try:
            try:
                supabase.table("approved_discounts").delete().eq("event_room_type_key", key).execute()
            except Exception:
                pass
            supabase.table("approved_discounts").insert(
                {"event_room_type_key": key}
            ).execute()
        except Exception as e:
            print(f"approve_discount Supabase sync error (file saved): {e}")

    return jsonify({"ok": True}), 200


@app.route("/api/discounts/dismiss", methods=["POST"])
def dismiss_discount():
    """Dismiss (remove) an approved discount."""
    data = request.get_json()
    key = data.get("event_room_type_key")
    if not key:
        return jsonify({"error": "event_room_type_key required"}), 400

    # Always remove from file (source of truth)
    keys = _load_approved_cache()
    keys.discard(key)
    _save_approved_cache(keys)

    # Also try Supabase (best effort)
    if _discounts_table_exists():
        try:
            supabase.table("approved_discounts").delete().eq(
                "event_room_type_key", key
            ).execute()
        except Exception as e:
            print(f"dismiss_discount Supabase sync error (file saved): {e}")

    return jsonify({"ok": True}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)