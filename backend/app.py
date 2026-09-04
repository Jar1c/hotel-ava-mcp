from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY, PAYMONGO_SECRET_KEY, PAYMONGO_BASE_URL
from datetime import datetime, date
from math import ceil
import os
import jwt as pyjwt
import uuid
import requests as http_requests

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://hotel-ava-mcp.vercel.app",
    "https://hotelava.vercel.app",
]}})

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


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

    try:
        res = supabase.auth.sign_up({"email": email, "password": password, "options": {"data": {"name": name}}})
        return jsonify({"user": {"id": res.user.id, "email": res.user.email, "name": name, "role": "guest"}}), 201
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


@app.route("/api/auth/profile", methods=["GET"])
def get_profile():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    profile = supabase.table("users").select("*").eq("id", user_id).single().execute()
    p = profile.data or {}

    # Get email from JWT claims (no admin API needed)
    email = p.get("email", "")
    if not email:
        try:
            payload = pyjwt.decode(token, options={"verify_signature": False, "verify_exp": False})
            email = payload.get("email", "")
        except Exception:
            email = ""

    return jsonify({
        "id": user_id,
        "email": email,
        "name": p.get("name", ""),
        "role": p.get("role", "guest"),
        "avatar_url": p.get("avatar_url", ""),
        "phone": p.get("phone", ""),
        "created_at": p.get("created_at", ""),
    }), 200


@app.route("/api/auth/profile", methods=["PUT"])
def update_profile():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json()
        updates = {}
        if "name" in data:
            updates["name"] = data["name"]
        if "avatar_url" in data:
            updates["avatar_url"] = data["avatar_url"]
        if "phone" in data:
            updates["phone"] = data["phone"]

        if updates:
            updates["updated_at"] = "now()"
            supabase.table("users").update(updates).eq("id", user_id).execute()

        user_record = supabase.table("users").select("*").eq("id", user_id).single().execute()
        p = user_record.data or {}

        return jsonify({
            "id": user_id,
            "email": p.get("email", ""),
            "name": p.get("name", ""),
            "role": p.get("role", "guest"),
            "avatar_url": p.get("avatar_url", ""),
            "phone": p.get("phone", ""),
        }), 200
    except Exception:
        return jsonify({"error": "Unauthorized"}), 401


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
                "amenities": r.get("amenities") or [],
                "images": r.get("images") or [],
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
            "amenities": data.get("amenities", []),
            "images": data.get("images", []),
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
            "amenities": r.get("amenities") or [],
            "images": r.get("images") or [],
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
            "amenities": data.get("amenities", []),
            "images": data.get("images", []),
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
            "amenities": r.get("amenities") or [],
            "images": r.get("images") or [],
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

def create_paymongo_checkout(booking_id, amount, email, description):
    """Create a PayMongo Checkout Session and return the checkout URL."""
    if not PAYMONGO_SECRET_KEY:
        return None

    try:
        import base64
        encoded_key = base64.b64encode(PAYMONGO_SECRET_KEY.encode()).decode()

        frontend_url = os.getenv("FRONTEND_URL", "https://hotelava.vercel.app")
        success_url = f"{frontend_url}/booking/confirmation/{booking_id}"
        cancel_url = f"{frontend_url}/booking/failed?booking={booking_id}"

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
            return checkout_url
        else:
            print(f"PayMongo error: {res.status_code} {res.text}")
            return None
    except Exception as e:
        print(f"PayMongo error: {e}")
        return None


# ── Bookings (user-facing) ──────────────────────────────────────────────────────

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

    if not room_id or not check_in or not check_out:
        return jsonify({"error": "room_id, check_in, and check_out are required"}), 400

    try:
        # Verify room exists and is available
        room_res = supabase.table("rooms").select("id, name, type, price").eq("id", room_id).execute()
        if not room_res.data:
            return jsonify({"error": "Room not found"}), 404

        room = room_res.data[0]

        # Check for overlapping bookings
        overlap_res = supabase.table("bookings").select("id").eq("room_id", room_id).eq("status", "confirmed").or_(
            f"and(check_in.lte.{check_out},check_out.gte.{check_in})"
        ).execute()

        if overlap_res.data and len(overlap_res.data) > 0:
            return jsonify({"error": "Room is not available for the selected dates"}), 409

        # Create booking with pending status
        booking_res = supabase.table("bookings").insert({
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
        }).execute()

        if not booking_res.data:
            return jsonify({"error": "Failed to create booking"}), 500

        booking = booking_res.data[0]
        booking_id = booking["id"]

        # Create PayMongo checkout session
        checkout_url = create_paymongo_checkout(
            booking_id=booking_id,
            amount=total_price,
            email=email,
            description=f"Booking: {booking_id}",
        )

        if checkout_url:
            return jsonify({
                "booking_id": booking_id,
                "checkout_url": checkout_url,
                "status": "pending",
            }), 201
        else:
            # No PayMongo configured — confirm directly
            supabase.table("bookings").update({"status": "confirmed"}).eq("id", booking_id).execute()
            return jsonify({
                "booking_id": booking_id,
                "status": "confirmed",
                "room_name": room["name"],
            }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


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

        # Batch-fetch room info
        room_ids = list({b["room_id"] for b in bookings if b.get("room_id")})
        rooms_map = {}
        if room_ids:
            rooms_res = supabase.table("rooms").select("id, name, type, images").in_("id", room_ids).execute()
            rooms_map = {r["id"]: r for r in (rooms_res.data or [])}

        result = []
        for b in bookings:
            room = rooms_map.get(b.get("room_id"), {})
            nights = days_between(b["check_in"], b["check_out"])
            images = room.get("images", [])
            result.append({
                "id": b["id"],
                "room_id": b.get("room_id"),
                "room_name": room.get("name", "Unknown"),
                "room_type": room.get("type", ""),
                "room_image": images[0] if images else "",
                "check_in": b["check_in"],
                "check_out": b["check_out"],
                "nights": nights,
                "guests": b.get("guests", 1),
                "total_price": b["total_price"],
                "status": b["status"],
                "payment_method": b.get("payment_method", ""),
                "created_at": b["created_at"],
            })

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
        booking_res = supabase.table("bookings").select("*").eq("id", booking_id).execute()
        if not booking_res.data:
            return jsonify({"error": "Booking not found"}), 404

        b = booking_res.data[0]
        if b["user_id"] != user_id:
            return jsonify({"error": "Forbidden"}), 403

        room_res = supabase.table("rooms").select("name, type, images").eq("id", b["room_id"]).execute()
        room = room_res.data[0] if room_res.data else {}
        nights = days_between(b["check_in"], b["check_out"])

        return jsonify({
            "id": b["id"],
            "room_name": room.get("name", "Unknown"),
            "room_type": room.get("type", ""),
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
        if b["status"] != "confirmed":
            return jsonify({"error": "Booking cannot be cancelled"}), 400

        supabase.table("bookings").update({"status": "cancelled"}).eq("id", booking_id).execute()
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
        booking_res = supabase.table("bookings").select("user_id, status, total_price, room_name").eq("id", booking_id).execute()
        if not booking_res.data:
            return jsonify({"error": "Booking not found"}), 404

        b = booking_res.data[0]
        if b["user_id"] != user_id:
            return jsonify({"error": "Forbidden"}), 403
        if b["status"] != "pending":
            return jsonify({"error": "Only pending bookings can be paid"}), 400

        user_res = supabase.table("users").select("email").eq("id", user_id).execute()
        email = user_res.data[0]["email"] if user_res.data else ""

        checkout_url = create_paymongo_checkout(
            booking_id,
            b["total_price"],
            email,
            f"Booking: {booking_id}",
        )

        if not checkout_url:
            return jsonify({"error": "Failed to create checkout session"}), 500

        return jsonify({"checkout_url": checkout_url}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
            users_res = supabase.table("users").select("id, name").in_("id", user_ids).execute()
            users_map = {u["id"]: u["name"] for u in (users_res.data or [])}

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
            result.append({
                "id": b["id"][:8].upper(),
                "guestName": users_map.get(uid, "Unknown"),
                "guestEmail": "",
                "roomType": room.get("type", "Unknown"),
                "roomNumber": room.get("name", ""),
                "checkIn": b["check_in"],
                "checkOut": b["check_out"],
                "nights": nights,
                "amount": b["total_price"],
                "status": b["status"],
            })

        return jsonify(result), 200
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

        bookings_res = supabase.table("bookings").select("user_id, total_price, check_out").execute()
        bookings = bookings_res.data or []

        user_stats = {}
        for b in bookings:
            uid = b["user_id"]
            if uid not in user_stats:
                user_stats[uid] = {"count": 0, "total_spent": 0, "last_stay": ""}
            s = user_stats[uid]
            s["count"] += 1
            s["total_spent"] += b["total_price"]
            if b["check_out"] > s["last_stay"]:
                s["last_stay"] = b["check_out"]

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
                "email": "",
                "phone": u.get("phone") or "—",
                "totalBookings": s["count"],
                "totalSpent": s["total_spent"],
                "lastStay": last_stay or "—",
                "status": status,
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
        now = datetime.now()
        month_start = f"{now.year}-{now.month:02d}-01"
        today = today_str()

        all_bookings = supabase.table("bookings").select("status, total_price, check_in, check_out").execute().data or []
        all_rooms = supabase.table("rooms").select("id, available").execute().data or []
        total_guests = supabase.table("users").select("id", count="exact").eq("role", "guest").execute()

        total_rooms = len(all_rooms) or 1
        total_bookings = len(all_bookings)
        confirmed = sum(1 for b in all_bookings if b["status"] == "confirmed")
        cancelled = sum(1 for b in all_bookings if b["status"] == "cancelled")
        monthly_revenue = sum(b["total_price"] for b in all_bookings if b["check_in"] >= month_start)
        occupied_today = sum(1 for b in all_bookings if b["status"] == "confirmed" and b["check_in"] <= today and b["check_out"] > today)
        occupancy_rate = round((occupied_today / total_rooms) * 100) if total_rooms else 0

        return jsonify({
            "totalBookings": total_bookings,
            "monthlyRevenue": monthly_revenue,
            "occupancyRate": occupancy_rate,
            "confirmedBookings": confirmed,
            "pendingBookings": confirmed,
            "cancelledBookings": cancelled,
            "totalGuests": 0,
            "activeGuests": occupied_today,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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

        return jsonify([{**s, "isPeak": s["month"] in peak_months} for s in month_stats]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analytics/room-performance", methods=["GET"])
def get_room_performance():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        rooms = supabase.table("rooms").select("id, type, price").execute().data or []
        bookings = supabase.table("bookings").select("room_id, total_price, check_in, check_out, status").neq("status", "cancelled").execute().data or []

        type_stats = {}
        for r in rooms:
            if r["type"] not in type_stats:
                type_stats[r["type"]] = {"revenue": 0, "nights": 0, "total_bookings": 0}

        for b in bookings:
            room = next((r for r in rooms if r["id"] == b["room_id"]), None)
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

        return jsonify(sorted(result, key=lambda x: x["revenue"], reverse=True)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analytics/insights", methods=["GET"])
def get_insights():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        rooms = supabase.table("rooms").select("id, type, price").execute().data or []
        bookings = supabase.table("bookings").select("room_id, total_price, check_in, check_out, status").neq("status", "cancelled").execute().data or []

        total_bookings = len(bookings)
        total_revenue = sum(b["total_price"] for b in bookings)

        type_revenue = {}
        for b in bookings:
            room = next((r for r in rooms if r["id"] == b["room_id"]), None)
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

        return jsonify([
            {"label": "Total Bookings", "value": str(total_bookings), "detail": "All time"},
            {"label": "Best Room", "value": best_room[0] if best_room else "—", "detail": f"₱{best_room[1]:,} revenue" if best_room else "No data"},
            {"label": "Total Revenue", "value": f"₱{total_revenue:,}", "detail": "All time"},
            {"label": "Peak Months", "value": peak, "detail": "Highest booking volume"},
        ]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analytics/forecast/occupancy", methods=["GET"])
def get_occupancy_forecast():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        # Get occupancy data first
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

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analytics/forecast/revenue", methods=["GET"])
def get_revenue_forecast():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
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

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analytics/demand-insights", methods=["GET"])
def get_demand_insights():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        rooms = supabase.table("rooms").select("id, type, price").execute().data or []
        bookings = supabase.table("bookings").select("room_id, check_in, check_out, status, total_price").neq("status", "cancelled").execute().data or []

        if not rooms:
            return jsonify([]), 200

        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        current_year = datetime.now().year
        current_month = datetime.now().month
        total_rooms = len(rooms)

        month_occ = []
        for i in range(12):
            mb = [b for b in bookings if datetime.strptime(b["check_in"][:10], "%Y-%m-%d").year == current_year and datetime.strptime(b["check_in"][:10], "%Y-%m-%d").month == i]
            nights = sum(days_between(b["check_in"], b["check_out"]) for b in mb)
            days = (datetime(current_year, i + 2, 1) - datetime(current_year, i + 1, 1)).days if i < 11 else 31
            total_nights = total_rooms * days
            occ = round((nights / total_nights) * 100) if total_nights > 0 else 0
            month_occ.append({"month": months[i], "monthIdx": i, "occupancy": occ})

        low_months = [m for m in month_occ if m["occupancy"] < 70 and m["monthIdx"] >= current_month]
        room_types = list(set(r["type"] for r in rooms))

        insights = []
        if low_months:
            # Group consecutive months
            periods = []
            start = low_months[0]["monthIdx"]
            end = start
            total_occ = low_months[0]["occupancy"]
            for lm in low_months[1:]:
                if lm["monthIdx"] == end + 1:
                    end = lm["monthIdx"]
                    total_occ += lm["occupancy"]
                else:
                    periods.append({"start": start, "end": end, "avg": round(total_occ / (end - start + 1))})
                    start = lm["monthIdx"]
                    end = start
                    total_occ = lm["occupancy"]
            periods.append({"start": start, "end": end, "avg": round(total_occ / (end - start + 1))})

            for p in periods:
                label = f"{months[p['start']]}"
                if p["start"] != p["end"]:
                    label += f"–{months[p['end']]}"
                label += f" {current_year}"

                discount = 10
                if p["avg"] < 50:
                    discount = 20
                elif p["avg"] < 60:
                    discount = 15

                affected = [t for t in room_types if any(r["type"] == t and r["price"] <= 3200 for r in rooms)]
                confidence = min(90, 60 + len(bookings))
                projected = round((p["avg"] / 100) * total_rooms * 30 * (1 + discount / 100))

                insights.append({
                    "id": f"DI-{len(insights) + 1}",
                    "period": label,
                    "predictedOccupancy": p["avg"],
                    "reason": f"Historically low occupancy period. Based on {len(bookings)} booking records.",
                    "recommendation": f"{discount}% discount on {' & '.join(affected)} to stimulate demand",
                    "discountPercent": discount,
                    "affectedRooms": affected,
                    "confidence": confidence,
                    "projectedImpact": f"+{round(discount * 0.8)}% revenue lift vs no action, +{projected} projected bookings",
                    "applied": False,
                })

        if not insights:
            insights.append({
                "id": "DI-1",
                "period": f"{months[current_month % 12]} {current_year if current_month < 12 else current_year + 1}",
                "predictedOccupancy": 75,
                "reason": "No significant low-demand periods detected. Occupancy is stable.",
                "recommendation": "Maintain current pricing. Consider promotional rates for weekdays.",
                "discountPercent": 5,
                "affectedRooms": room_types,
                "confidence": 65,
                "projectedImpact": "+3% weekday occupancy",
                "applied": False,
            })

        return jsonify(insights), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analytics/discount-offers", methods=["GET"])
def get_discount_offers():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    set_auth(token)
    user_id = get_user_from_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        rooms = supabase.table("rooms").select("type, price").execute().data or []
        bookings = supabase.table("bookings").select("room_id, check_in, status").neq("status", "cancelled").execute().data or []

        if not rooms:
            return jsonify([]), 200

        current_year = datetime.now().year
        current_month = datetime.now().month
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        total_rooms = len(rooms)

        room_type_map = {}
        for r in rooms:
            if r["type"] not in room_type_map or r["price"] < room_type_map[r["type"]]:
                room_type_map[r["type"]] = r["price"]

        month_occ = []
        for i in range(12):
            mb = [b for b in bookings if datetime.strptime(b["check_in"][:10], "%Y-%m-%d").year == current_year and datetime.strptime(b["check_in"][:10], "%Y-%m-%d").month == i]
            nights = sum(days_between(b["check_in"], b["check_in"]) for b in mb)
            days = (datetime(current_year, i + 2, 1) - datetime(current_year, i + 1, 1)).days if i < 11 else 31
            total_nights = total_rooms * days
            occ = round((nights / total_nights) * 100) if total_nights > 0 else 0
            month_occ.append({"month": months[i], "monthIdx": i, "occupancy": occ})

        low_months = [m for m in month_occ if m["occupancy"] < 70 and m["monthIdx"] >= current_month]
        offers = []

        for lm in low_months[:3]:
            discount = 20 if lm["occupancy"] < 50 else 15
            valid_from = f"{current_year}-{lm['monthIdx'] + 1:02d}-01"
            days_in_month = (datetime(current_year, lm["monthIdx"] + 2, 1) - datetime(current_year, lm["monthIdx"] + 1, 1)).days
            valid_to = f"{current_year}-{lm['monthIdx'] + 1:02d}-{days_in_month}"

            for t, price in room_type_map.items():
                discounted = round(price * (1 - discount / 100))
                projected = round(lm["occupancy"] / 100 * total_rooms * 0.3)
                offers.append({
                    "id": f"DO-{len(offers) + 1}",
                    "roomType": t,
                    "discountPercent": discount,
                    "validFrom": valid_from,
                    "validTo": valid_to,
                    "baseRate": price,
                    "discountedRate": discounted,
                    "projectedBookings": projected,
                    "projectedRevenue": projected * discounted,
                    "status": "scheduled",
                })

        return jsonify(offers), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── PayMongo Webhook ────────────────────────────────────────────────────────────

@app.route("/api/webhook/paymongo", methods=["POST"])
def paymongo_webhook():
    """Handle PayMongo payment events."""
    try:
        payload = request.get_json()
        event_type = payload.get("data", {}).get("attributes", {}).get("type", "")
        print(f"Webhook received: {event_type}")

        if event_type == "payment.paid":
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
                # Update booking status to confirmed
                result = supabase.table("bookings").update({"status": "confirmed"}).eq("id", booking_id).execute()
                print(f"Booking {booking_id} confirmed via webhook")

                # Mark the room as occupied
                booking_res = supabase.table("bookings").select("room_id").eq("id", booking_id).execute()
                if booking_res.data:
                    room_id = booking_res.data[0].get("room_id")
                    if room_id:
                        supabase.table("rooms").update({"available": False}).eq("id", room_id).execute()
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
        # Update booking status to confirmed
        supabase.table("bookings").update({"status": "confirmed"}).eq("id", booking_id).execute()

        booking_res = supabase.table("bookings").select("room_id, check_in, check_out").eq("id", booking_id).execute()
        if booking_res.data:
            b = booking_res.data[0]
            room_res = supabase.table("rooms").select("name").eq("id", b["room_id"]).execute()
            room_name = room_res.data[0]["name"] if room_res.data else "Room"
            return jsonify({
                "booking_id": booking_id,
                "status": "confirmed",
                "room_name": room_name,
                "check_in": b["check_in"],
                "check_out": b["check_out"],
            }), 200

        return jsonify({"booking_id": booking_id, "status": "confirmed"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Health ─────────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)
