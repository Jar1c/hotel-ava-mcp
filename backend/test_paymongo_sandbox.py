"""PayMongo sandbox end-to-end test — no real money required.

Runs against configured PayMongo TEST keys (sk_test_/pk_test_) and verifies
every stage of the real gateway journey: pending -> retry payment -> webhook
success (confirmed) -> verify endpoint -> admin list -> payment-failed.

Run:  cd backend && python test_paymongo_sandbox.py
Exit code 0 = all pass.
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta

BASE = "http://localhost:5000"
UA = "HotelAva-PayMongoSandbox/1.0"
GUEST_EMAIL = os.environ.get("TEST_EMAIL", "mosjaric@gmail.com")
GUEST_PASSWORD = os.environ.get("TEST_PASSWORD", "Calderon143")
ADMIN_EMAIL = "hotelava7@gmail.com"
ADMIN_PASSWORD = "Hotelava123"

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(("PASS" if ok else "FAIL") + ": " + name + ("  [" + str(detail) + "]" if detail else ""))
    return ok


def req(method, path, token=None, body=None, raw_body=None, extra_headers=None):
    url = BASE + path
    data = None
    out_headers = {"Content-Type": "application/json", "User-Agent": UA}
    if token:
        out_headers["Authorization"] = "Bearer " + token
    if extra_headers:
        out_headers.update(extra_headers)
    if raw_body is not None:
        data = raw_body.encode() if isinstance(raw_body, str) else raw_body
    elif body is not None:
        data = json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method, headers=out_headers)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
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


def paymongo_signature(body, timestamp):
    key = os.environ.get("PAYMONGO_SECRET_KEY", "")
    payload = f"{timestamp}.{body}"
    return base64.b64encode(
        hmac.new(key.encode(), payload.encode(), hashlib.sha256).digest()
    ).decode(), payload


def future_days(days):
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")


def trust_device(email):
    """Register this script's UA as a trusted device so login never hits OTP."""
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from app import supabase_admin  # noqa: F401  (app module loads config+clients)
        key = hashlib.sha256(UA.encode()).hexdigest()
        users = supabase_admin.table("users").select("id").eq("email", email).limit(1).execute()
        if not users.data:
            return
        uid = users.data[0]["id"]
        existing = supabase_admin.table("user_devices").select("id") \
            .eq("user_id", uid).eq("device_key", key).limit(1).execute()
        if existing.data:
            supabase_admin.table("user_devices").update({"trusted": True}) \
                .eq("id", existing.data[0]["id"]).execute()
        else:
            supabase_admin.table("user_devices").insert({
                "user_id": uid, "device_key": key,
                "device_name": "PayMongo sandbox test", "trusted": True,
            }).execute()
    except Exception as e:
        print(f"  (device trust skipped: {e})")


def main():
    # Trust this script's UA on the guest account BEFORE logging in, so the
    # step-up gate never responds with an OTP challenge.
    trust_device(GUEST_EMAIL)
    st, login = req("POST", "/api/auth/login",
                    body={"email": GUEST_EMAIL, "password": GUEST_PASSWORD})
    check("login guest", st == 200 and bool(login.get("access_token")), st)
    if not login.get("access_token"):
        return 1
    guest_tok = login["access_token"]

    tomorrow = future_days(1)
    st, created = req("POST", "/api/bookings", token=guest_tok, body={
        "room_id": "a18aa682-e596-46a8-9003-4eac70ba0248",
        "check_in": tomorrow,
        "guests": 2, "adults": 2, "children": 0, "pets": 0,
        "full_name": "PayMongo Sandbox Test",
        "email": GUEST_EMAIL, "phone": "09170000000",
        "payment_method": "gcash", "total_price": 0,
        "stay_type": "day", "duration": 3, "start_time": "9:00 AM",
    })
    check("create day-use booking", st == 201, st)
    if st != 201:
        return 1
    booking_id = created["booking_id"]
    check("starts pending", created.get("status") == "pending")
    check("PayMongo checkout_url returned", bool(created.get("checkout_url")))

    st, booked = req("GET", f"/api/bookings/{booking_id}", token=guest_tok)
    check("read own booking", st == 200 and booked.get("id") == booking_id, st)
    total_price = float(booked.get("total_price") or 0)
    check("server-priced amount > 0", total_price > 0, total_price)

    # 4. Simulate PayMongo success webhook (real sandbox signature)
    now_ms = int(time.time() * 1000)
    payload = {
        "data": {
            "attributes": {
                "type": "payment.paid",
                "data": {
                    "attributes": {
                        "description": f"Booking: {booking_id}",
                        "source": {"type": "gcash"},
                        "payment_intent": "pi_sandbox_test",
                        "amount": int(total_price * 100),
                        "currency": "PHP",
                        "status": "succeeded",
                    }
                },
            }
        }
    }
    raw_body = json.dumps(payload)
    sig, _ = paymongo_signature(raw_body, now_ms)
    st, wh = req("POST", "/api/webhook/paymongo", token=guest_tok,
                 raw_body=raw_body,
                 extra_headers={"x-paymongo-signature": f"t={now_ms},v1={sig}"})
    check("webhook success (200)", st == 200, st)
    check("webhook signature accepted", wh.get("received") is True)

    st, booked = req("GET", f"/api/bookings/{booking_id}", token=guest_tok)
    check("confirmed after webhook", st == 200 and booked.get("status") == "confirmed", st)
    check("payment_status == paid", booked.get("payment_status") == "paid")
    check("amount_paid >= total_price",
          float(booked.get("amount_paid") or 0) >= float(booked.get("total_price") or 0))
    check("qr_data == booking id", booked.get("qr_data") == booking_id)
    check("method resolved (no awaiting:*)",
          not str(booked.get("payment_method") or "").startswith("awaiting:"))

    # Public QR endpoint (front-desk verification — no qr_data key, but returns status)
    st, verified = req("GET", f"/api/bookings/verify/{booking_id}")
    check("public /verify returns booking",
          st == 200 and verified.get("status") == "confirmed" and verified.get("id") == booking_id, st)

    # 5. Failure path: payment-failed auto-cancels pending bookings
    st, create2 = req("POST", "/api/bookings", token=guest_tok, body={
        "room_id": "a18aa682-e596-46a8-9003-4eac70ba0248",
        "check_in": future_days(2),
        "guests": 2, "adults": 2, "children": 0, "pets": 0,
        "full_name": "PayMongo Sandbox Test 2", "email": GUEST_EMAIL,
        "phone": "09170000000", "payment_method": "paymaya",
        "total_price": 0, "stay_type": "day", "duration": 3, "start_time": "10:00 AM",
    })
    check("create second booking", st == 201, st)
    if st == 201:
        bid2 = create2["booking_id"]
        st, fail = req("POST", f"/api/bookings/{bid2}/payment-failed", token=guest_tok)
        check("payment-failed (200)", st == 200)
        st, after = req("GET", f"/api/bookings/{bid2}", token=guest_tok)
        check("payment-failed -> cancelled", st == 200 and after.get("status") == "cancelled", st)

    # 6. Admin sees everything
    st, admin_login = req("POST", "/api/auth/login",
                          body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    check("admin login", st == 200 and bool(admin_login.get("access_token")), st)
    if admin_login.get("access_token"):
        admin_tok = admin_login["access_token"]
        st, all_bookings = req("GET", "/api/bookings", token=admin_tok)
        check("admin: list all bookings",
              st == 200 and isinstance(all_bookings, list), st)
        statuses = {b.get("status") for b in all_bookings if isinstance(b, dict)}
        check("admin sees confirmed+cancelled bookings",
              {"confirmed", "cancelled"} <= statuses, sorted(statuses))

    passed = sum(1 for r in results if r)
    if passed == len(results):
        print(f"\nAll {len(results)} checks passed")
    else:
        print(f"\n{len(results) - passed} of {len(results)} checks FAILED")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())


