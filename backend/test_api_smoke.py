"""API smoke test — public, guest and admin endpoints + the booking lifecycle.

Run:  cd backend && python test_api_smoke.py
Exit code 0 = all pass.

Covers what the Playwright suite can't cheaply reach: pricing quotes, the
create → read → cancel booking lifecycle, admin dashboards/analytics, and
authz gates (guest token on admin routes must 403). Creates one day-use
booking and cancels it again as cleanup.
"""
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta

BASE = "http://localhost:5000"
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BACKEND_DIR)
UA = "HotelAva-APISmoke/1.0"

GUEST_EMAIL = os.environ.get("TEST_EMAIL", "mosjaric@gmail.com")
GUEST_PASSWORD = os.environ.get("TEST_PASSWORD", "Calderon143")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "hotelava7@gmail.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Hotelava123")


def req(method, path, token=None, body=None):
    """(status, json) for an API call. status 0 = network error."""
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    r.add_header("User-Agent", UA)
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=25) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode() or "null")
        except Exception:
            payload = None
        return e.code, payload
    except Exception as e:
        return 0, {"error": str(e)}


results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    line = ("PASS" if ok else "FAIL") + ": " + name
    if detail:
        line += "  [" + str(detail) + "]"
    print(line)
    return ok


def trust_device(supabase_admin, user_id):
    """Register this script's UA as a trusted device so login never hits OTP."""
    key = hashlib.sha256(UA.encode()).hexdigest()
    try:
        existing = supabase_admin.table("user_devices").select("id") \
            .eq("user_id", user_id).eq("device_key", key).limit(1).execute()
        if existing.data:
            supabase_admin.table("user_devices").update({"trusted": True}) \
                .eq("id", existing.data[0]["id"]).execute()
        else:
            supabase_admin.table("user_devices").insert({
                "user_id": user_id, "device_key": key,
                "device_name": "API smoke test", "trusted": True,
            }).execute()
    except Exception as e:
        print("  (device trust skipped: %s)" % e)


def main():
    # ── Public endpoints ────────────────────────────────────────────────────
    st, body = req("GET", "/api/health")
    check("public: /api/health", st == 200 and (body or {}).get("status") == "ok", st)

    st, rooms = req("GET", "/api/rooms/public")
    room_list = rooms if isinstance(rooms, list) else []
    check("public: /api/rooms/public returns rooms", st == 200 and len(room_list) > 0,
          "%s rooms" % len(room_list))
    if not room_list:
        print("No rooms available — cannot continue.")
        return 1

    st, quotes = req("POST", "/api/rooms/quotes", body={
        "room_ids": [room_list[0]["id"]],
        "check_in": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
        "stay_type": "day", "duration": 3,
    })
    check("public: /api/rooms/quotes prices a day-use stay",
          st == 200 and isinstance(quotes, list) and len(quotes) > 0, st)

    st, featured = req("GET", "/api/reviews/featured")
    check("public: /api/reviews/featured", st == 200, st)

    # ── Guest auth + booking lifecycle ──────────────────────────────────────
    st, login = req("POST", "/api/auth/login",
                    body={"email": GUEST_EMAIL, "password": GUEST_PASSWORD})
    guest_tok = (login or {}).get("access_token")

    # The step-up gate may 202 a challenge for unknown devices — trust ours
    # via the app's own Supabase admin client, then retry once.
    if st == 202 or not guest_tok:
        try:
            sys.path.insert(0, BACKEND_DIR)
            from app import supabase_admin
            # The 202 challenge body carries no user id — look it up by email.
            ures = supabase_admin.table("users").select("id") \
                .eq("email", GUEST_EMAIL).limit(1).execute()
            if ures.data:
                trust_device(supabase_admin, ures.data[0]["id"])
            st, login = req("POST", "/api/auth/login",
                            body={"email": GUEST_EMAIL, "password": GUEST_PASSWORD})
            guest_tok = (login or {}).get("access_token")
        except Exception as e:
            print("  (retry setup failed: %s)" % e)
    check("guest: login", st == 200 and bool(guest_tok), st)

    if guest_tok:
        st, mine = req("GET", "/api/bookings/mine", token=guest_tok)
        check("guest: /api/bookings/mine", st == 200 and isinstance(mine, list),
              "%s bookings" % (len(mine) if isinstance(mine, list) else "?"))

        st, conf = req("POST", "/api/bookings/check-conflict", token=guest_tok, body={
            "room_id": room_list[0]["id"],
            "check_in": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
            "stay_type": "day", "start_time": "9:00 AM", "duration": 3,
        })
        check("guest: /api/bookings/check-conflict",
              st == 200 and isinstance(conf, dict) and "conflict" in conf, st)

        st, rm_reviews = req("GET", "/api/reviews/room/%s" % room_list[0]["id"])
        check("guest: /api/reviews/room/<id>", st == 200, st)

        st, my_reviews = req("GET", "/api/reviews/mine", token=guest_tok)
        check("guest: /api/reviews/mine", st == 200, st)

        # Full booking lifecycle: create (day-use) → read → cancel (cleanup).
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        booking_id, create_status = None, None
        for room in room_list[:4]:
            st, created = req("POST", "/api/bookings", token=guest_tok, body={
                "room_id": room["id"],
                "check_in": tomorrow,
                "guests": 1, "adults": 1, "children": 0, "pets": 0,
                "full_name": "API Smoke Test",
                "email": GUEST_EMAIL,
                "phone": "09000000000",
                "payment_method": "gcash",
                "total_price": 0,  # ignored — server recomputes
                "stay_type": "day",
                "duration": 3,
                "start_time": "9:00 AM",
            })
            if st == 201 and (created or {}).get("booking_id"):
                booking_id = created["booking_id"]
                create_status = created.get("status")
                check("guest: create day-use booking (%s)" % room["name"], True,
                      "status=%s checkout_url=%s" % (
                          create_status, "yes" if created.get("checkout_url") else "no"))
                break
            print("  (room %s not bookable: %s %s)" % (room["name"], st, created))
        check("guest: create day-use booking", bool(booking_id))

        if booking_id:
            st, fetched = req("GET", "/api/bookings/%s" % booking_id, token=guest_tok)
            check("guest: read own booking",
                  st == 200 and (fetched or {}).get("id") == booking_id, st)

            st, cancelled = req("POST", "/api/bookings/%s/cancel" % booking_id,
                                token=guest_tok, body={"reason": "API smoke test cleanup"})
            check("guest: cancel own booking (cleanup)",
                  st == 200, (cancelled or {}).get("status") or (cancelled or {}).get("message") or st)

            st, after = req("GET", "/api/bookings/%s" % booking_id, token=guest_tok)
            check("booking status is cancelled after cancel",
                  st == 200 and (after or {}).get("status") == "cancelled",
                  (after or {}).get("status"))

        st, _ = req("GET", "/api/bookings/mine", token="badtoken")
        check("authz: bad token → 401 on /bookings/mine", st == 401, st)

    # ── Admin endpoints ─────────────────────────────────────────────────────
    st, alogin = req("POST", "/api/auth/login",
                     body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    admin_tok = (alogin or {}).get("access_token")
    check("admin: login", st == 200 and bool(admin_tok), st)

    if admin_tok:
        admin_gets = [
            ("/api/bookings", "all bookings"),
            ("/api/dashboard/stats", "dashboard stats"),
            ("/api/admin/dashboard-summary", "dashboard summary"),
            ("/api/guests", "guests list"),
            ("/api/rooms", "rooms (admin)"),
            ("/api/reviews", "reviews (admin)"),
            ("/api/analytics/seasonal", "analytics seasonal"),
            ("/api/analytics/room-performance", "analytics room performance"),
            ("/api/analytics/forecast/occupancy", "forecast occupancy"),
            ("/api/analytics/forecast/revenue", "forecast revenue"),
            ("/api/analytics/insights", "analytics insights"),
            ("/api/discounts/active", "active discounts"),
            ("/api/discounts/approved", "approved discounts"),
            ("/api/analytics/demand-insights", "demand insights"),
            ("/api/analytics/room-demand", "room demand"),
            ("/api/analytics/ai-recommendations", "ai recommendations"),
        ]
        for path, label in admin_gets:
            st, _ = req("GET", path, token=admin_tok)
            check("admin: GET %s (%s)" % (path, label), st == 200, st)

        if guest_tok:
            st, _ = req("GET", "/api/guests", token=guest_tok)
            check("authz: guest token → 403 on /api/guests", st in (401, 403), st)
        st, _ = req("GET", "/api/guests")
        check("authz: no token → 401 on /api/guests", st == 401, st)

    passed = sum(1 for r in results if r)
    total = len(results)
    print("\n%d/%d checks passed" % (passed, total))
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
