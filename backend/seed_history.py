"""Seed about a year of booking history so the admin AI analytics has data.

    python backend/seed_history.py                 # 365 days of history
    python backend/seed_history.py --days 180      # shorter run
    python backend/seed_history.py --clear         # undo a previous run

Every id it creates is written to backend/.seed_ids.json, so --clear removes
exactly those rows and never touches real bookings. Fake guest names/emails
are used; user_id points at the existing guest accounts so foreign keys hold.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import SUPABASE_SERVICE_KEY, SUPABASE_URL  # noqa: E402

IDS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".seed_ids.json")
REVIEW_IDS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".seed_review_ids.json")
BATCH = 100
REVIEW_RATE = 0.62

# Roughly when Malate hotels fill up: Dec / Holy Week / Apr strong, Jun-Sep rainy.
SEASON_FACTOR = {
    1: 1.05, 2: 1.0, 3: 1.1, 4: 1.2, 5: 1.0, 6: 0.85,
    7: 0.8, 8: 0.8, 9: 0.9, 10: 1.05, 11: 1.15, 12: 1.3,
}
BASE_OCCUPANCY = 0.34

FAKE_GUESTS = [
    ("Marco Dela Cruz", "marco.delacruz@example.com"),
    ("Angela Santos", "angela.santos@example.com"),
    ("Ryan Bautista", "ryan.bautista@example.com"),
    ("Nicole Reyes", "nicole.reyes@example.com"),
    ("Kevin Villanueva", "kevin.villanueva@example.com"),
    ("Patricia Lim", "patricia.lim@example.com"),
    ("Miguel Torres", "miguel.torres@example.com"),
    ("Sarah Aquino", "sarah.aquino@example.com"),
]
PAYMENT_METHODS = ["gcash", "paymaya", "card"]
OVERNIGHT_STARTS = ["12:00 PM", "2:00 PM", "4:00 PM", "6:00 PM", "8:00 PM", "10:00 PM"]
DAY_DURATIONS = [3, 4, 6, 8, 12]

# rating -> comment pool, plus the share of reviews that land on each rating
RATING_WEIGHTS = [(5, 0.44), (4, 0.31), (3, 0.15), (2, 0.06), (1, 0.04)]
REVIEW_COMMENTS = {
    5: [
        "Malinis ang room, mabait ang staff, at tahimik ang gabi. Sulit ang bayad!",
        "Great stay - the bed was comfy and check-in was quick. Would book again.",
        "Above expectations. Room was spotless and the water pressure was strong.",
        "Perfect for our Manila trip, walking distance to restaurants and bars.",
        "Napakaganda ng room at very responsive ng staff. Highly recommended!",
        "Second time staying here and it was just as good as the first.",
        "Comfy bed, quiet aircon, and the housekeeping was on point every morning.",
    ],
    4: [
        "Solid stay, konting noise lang gabi pero okay pa rin.",
        "Good value for money. Room was clean, just a bit small for two.",
        "Comfortable bed and friendly staff. Aircon could be stronger.",
        "Mabuti ang experience, pero medyo matagal ang check-in.",
        "Nice room overall, only wish there were more power outlets by the bed.",
        "Clean and convenient. Towels could be a little thicker though.",
    ],
    3: [
        "Okay lang. Room was fine but the hallway was noisy at night.",
        "Average stay - nothing special, but nothing broken either.",
        "Decent for the price. Wi-Fi was slow when we needed it.",
        "Room is okay, pero yung hot water nagtagal bago lumabas.",
        "Fair stay. Location is great, facilities are a bit dated.",
    ],
    2: [
        "Room needed a deeper clean, and the AC was not cooling well.",
        "Madaming sira-sira, sana inayos muna bago i-offer.",
        "Check-in took almost an hour and the room smelled like smoke.",
        "Acceptable only because of the rate. Would not return unless improved.",
    ],
    1: [
        "Very disappointing. The bathroom had issues and staff were unhelpful.",
        "Hindi ko po ire-recommend, ang tagal namin nag-antay sira pa ang aircon.",
    ],
}


def rest(path: str, payload=None, method: str | None = None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            body = res.read()
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"PostgREST {exc.code} on {path}: {exc.read().decode()[:600]}")
    return json.loads(body) if body else None


def day_price(room: dict, duration: int) -> int:
    """Day use is billed as night * hours / 24 - same rule the app uses."""
    return max(150, round(room["price"] * duration / 24))


def fetch_all(path: str) -> list[dict]:
    """Read a whole table - PostgREST caps a single page at 1000 rows."""
    rows: list[dict] = []
    offset = 0
    while True:
        page = rest(f"{path}&offset={offset}&limit=1000")
        rows.extend(page)
        if len(page) < 1000:
            return rows
        offset += 1000


def busy_dates() -> dict[str, set[date]]:
    """Dates each room already has a stay on.

    bookings_no_overlap uses daterange(check_in, check_out, '[]') - inclusive -
    so the check_out day counts as occupied. A stay on [d, d+1] therefore also
    blocks d+1, which is why a 1-day gap is kept between stays.
    """
    from collections import defaultdict

    blocked: dict[str, set[date]] = defaultdict(set)
    for b in fetch_all("bookings?select=room_id,check_in,check_out"):
        start = date.fromisoformat(b["check_in"])
        end = date.fromisoformat(b["check_out"])
        for i in range((end - start).days + 1):
            blocked[b["room_id"]].add(start + timedelta(days=i))
    return blocked


def build_bookings(days: int) -> list[dict]:
    rooms = rest("rooms?select=id,type,price")
    rng = random.Random(42)
    today = date.today()
    blocked = busy_dates()
    rows: list[dict] = []

    for offset in range(days, 0, -1):
        d = today - timedelta(days=offset)
        factor = SEASON_FACTOR[d.month]
        # Weekends fill up faster than weekdays.
        if d.weekday() >= 5:
            factor *= 1.25

        for room in rooms:
            if d in blocked[room["id"]]:
                continue
            if rng.random() > BASE_OCCUPANCY * factor:
                continue
            blocked[room["id"]].add(d)
            blocked[room["id"]].add(d + timedelta(days=1))

            guest_name, guest_email = FAKE_GUESTS[rng.randrange(len(FAKE_GUESTS))]
            stay_day = rng.random() < 0.16

            if stay_day:
                duration = rng.choice(DAY_DURATIONS)
                start_time = rng.choice(["9:00 AM", "11:00 AM", "2:00 PM", "6:00 PM", "8:00 PM"])
                total = day_price(room, duration)
                stay_fields = {
                    "stay_type": "day",
                    "duration": duration,
                    "start_time": start_time,
                    "stays": f"{duration} Hours",
                }
            else:
                duration = None
                start_time = rng.choice(OVERNIGHT_STARTS)
                total = room["price"]
                stay_fields = {
                    "stay_type": "overnight",
                    "duration": None,
                    "start_time": start_time,
                    "stays": "24 Hours",
                }

            roll = rng.random()
            status = "completed" if roll < 0.82 else ("cancelled" if roll < 0.95 else "checked-out")
            created = datetime.combine(
                d - timedelta(days=rng.randint(1, 30)),
                datetime.min.time(),
                tzinfo=timezone.utc,
            ) + timedelta(hours=rng.randint(8, 21), minutes=rng.randint(0, 59))

            rows.append({
                "id": str(uuid.uuid4()),
                "user_id": None,  # mapped to the matching seed guest in seed()
                "room_id": room["id"],
                "check_in": d.isoformat(),
                "check_out": (d + timedelta(days=1)).isoformat(),
                "guests": rng.randint(1, 4),
                "total_price": total,
                "status": status,
                "payment_method": rng.choice(PAYMENT_METHODS),
                "full_name": guest_name,
                "email": guest_email,
                "phone": "",
                "special_requests": "",
                "payment_mode": "full",
                "amount_paid": total if status != "cancelled" else 0,
                "created_at": created.isoformat(),
                **stay_fields,
            })

    return rows


def _auth_admin(path: str, payload: dict | None = None, method: str = "POST") -> dict:
    url = f"{SUPABASE_URL}/auth/v1/{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            body = res.read()
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"Supabase Auth {exc.code} on {path}: {exc.read().decode()[:400]}")
    return json.loads(body) if body else {}


def ensure_seed_users() -> dict[str, str]:
    """Create one fake guest account per FAKE_GUESTS entry and return email -> id.

    public.users.id is a foreign key to auth.users, so the account has to be
    made through the Auth admin API - the insert trigger copies name/avatar_url
    into public.users.

    Seeded bookings must never point at a real Google account: the admin table
    reads users.avatar_url for the guest picture, so reusing a real user would
    put that person's Google profile photo next to a made-up booking.
    """
    existing = {u["email"]: u["id"] for u in fetch_all("users?select=id,email")}
    mapping: dict[str, str] = {}
    created = 0

    for name, email in FAKE_GUESTS:
        user_id = existing.get(email)
        if not user_id:
            try:
                user_id = _auth_admin(
                    "admin/users",
                    {
                        "email": email,
                        "password": f"Seed-{uuid.uuid4().hex[:16]}!",
                        "email_confirm": True,
                        "user_metadata": {"full_name": name, "avatar_url": ""},
                    },
                ).get("id")
            except SystemExit:
                # already registered in auth but missing from public.users
                user_id = next(
                    (u["id"] for u in _auth_admin("admin/users?page=1&per_page=200", method="GET")
                     .get("users", []) if u.get("email") == email),
                    None,
                )
                if not user_id:
                    raise
            created += 1
        mapping[email] = user_id

    if created:
        print(f"  created {created} seed guest accounts (no Google avatar)")
    return mapping


def clear() -> int:
    if not os.path.exists(IDS_FILE):
        print("Nothing to clear - no .seed_ids.json found.")
        return 0
    with open(IDS_FILE, "r") as f:
        ids = json.load(f)
    removed = 0
    for i in range(0, len(ids), 50):
        chunk = ",".join(ids[i:i + 50])
        rest(f"bookings?id=in.({chunk})", method="DELETE")
        removed += len(ids[i:i + 50])
    os.remove(IDS_FILE)
    # reviews reference bookings with ON DELETE CASCADE, but drop the id file too
    if os.path.exists(REVIEW_IDS_FILE):
        os.remove(REVIEW_IDS_FILE)
    return removed


def seed_reviews() -> int:
    """Write a review for most completed seeded stays - one per booking."""
    if not os.path.exists(IDS_FILE):
        print("No seeded bookings found - run the seed first.")
        return 0

    with open(IDS_FILE, "r") as f:
        seeded = set(json.load(f))

    bookings = fetch_all("bookings?select=id,room_id,user_id,check_out,status")
    already = {r["booking_id"] for r in fetch_all("reviews?select=booking_id")}
    now = datetime.now(timezone.utc)
    rng = random.Random(7)

    ratings = [rating for rating, _ in RATING_WEIGHTS]
    weights = [weight for _, weight in RATING_WEIGHTS]
    rows: list[dict] = []

    for b in bookings:
        if b["id"] not in seeded or b["id"] in already:
            continue
        if b["status"] not in ("completed", "checked-out"):
            continue
        if rng.random() > REVIEW_RATE:
            continue

        rating = rng.choices(ratings, weights=weights)[0]
        checkout = date.fromisoformat(b["check_out"])
        created = datetime.combine(
            checkout + timedelta(days=rng.randint(1, 14)),
            datetime.min.time(),
            tzinfo=timezone.utc,
        ) + timedelta(hours=rng.randint(8, 22), minutes=rng.randint(0, 59))
        if created > now:
            created = now - timedelta(hours=rng.randint(1, 48))

        rows.append({
            "id": str(uuid.uuid4()),
            "booking_id": b["id"],
            "room_id": b["room_id"],
            "user_id": b["user_id"],
            "rating": rating,
            "comment": rng.choice(REVIEW_COMMENTS[rating]),
            "images": [],
            "created_at": created.isoformat(),
        })

    created_ids: list[str] = []
    skipped = 0
    for i in range(0, len(rows), BATCH):
        ok, skip = insert_rows("reviews", rows[i:i + BATCH], created_ids)
        skipped += skip
        print(f"  reviews inserted {len(created_ids)}/{len(rows)} (skipped {skipped})")

    with open(REVIEW_IDS_FILE, "w") as f:
        json.dump(created_ids, f)
    return len(created_ids)


def insert_rows(table: str, batch: list[dict], created: list[str]) -> tuple[int, int]:
    """Insert a batch, splitting down to single rows when a constraint rejects
    it, so one clash never aborts the whole run."""
    try:
        rest(table, payload=batch, method="POST")
        created.extend(r["id"] for r in batch)
        return len(batch), 0
    except SystemExit:
        if len(batch) == 1:
            return 0, 1
        mid = len(batch) // 2
        left_ok, left_skip = insert_rows(table, batch[:mid], created)
        right_ok, right_skip = insert_rows(table, batch[mid:], created)
        return left_ok + right_ok, left_skip + right_skip


def seed(days: int) -> int:
    rows = build_bookings(days)
    email_to_id = ensure_seed_users()

    for row in rows:
        row["user_id"] = email_to_id[row["email"]]

    created_ids: list[str] = []
    skipped = 0
    for i in range(0, len(rows), BATCH):
        ok, skip = insert_rows("bookings", rows[i:i + BATCH], created_ids)
        skipped += skip
        print(f"  inserted {len(created_ids)}/{len(rows)} (skipped {skipped})")

    with open(IDS_FILE, "w") as f:
        json.dump(created_ids, f)
    if skipped:
        print(f"Skipped {skipped} rows that clashed with existing bookings.")
    return len(created_ids)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=365, help="how many days of history")
    parser.add_argument("--clear", action="store_true", help="delete rows from a previous run")
    parser.add_argument("--reviews", action="store_true", help="only seed reviews for existing seeded stays")
    args = parser.parse_args()

    if not SUPABASE_SERVICE_KEY:
        raise SystemExit("SUPABASE_SERVICE_KEY is not set - refusing to seed.")

    if args.clear:
        print(f"Removed {clear()} seeded bookings.")
        return

    if args.reviews:
        print(f"Seeded {seed_reviews()} reviews.")
        return

    count = seed(args.days)
    print(f"Seeded {count} bookings over the last {args.days} days.")
    print(f"Seeded {seed_reviews()} reviews for those stays.")


if __name__ == "__main__":
    main()
