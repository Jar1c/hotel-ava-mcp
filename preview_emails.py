import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from email_service import build_email

booking = {
    "id": "b7e4c1a9-3f52-4d88-9c21-8a6e0f15d3b4",
    "full_name": "Maria Clara Santos",
    "email": "guest@example.com",
    "phone": "0917 123 4567",
    "check_in": "2026-10-18",
    "check_out": "2026-10-20",
    "guests": 2,
    "adults": 2,
    "children": 0,
    "total_price": 4760,
    "amount_paid": 2380,
    "payment_mode": "downpayment",
    "payment_method": "gcash",
    "stay_type": "overnight",
    "stays": "24 Hours",
    "start_time": "",
    "duration": "",
}

room_name = "Superior Suite 205"
room_type = "Superior Suite"
image_url = "https://voabhnoephsgdkklabgo.supabase.co/storage/v1/object/public/room-images/rooms/bdc1cd3fb8e84a12b0a320311a3bc808.png"
events = [
    ("confirmed", {}),
    ("cancelled", {}),
    ("refund", {"refund_amount": 2380}),
    ("failed", {}),
    ("expired", {}),
    ("settled", {}),
    ("checkin", {}),
    ("checkin", {"arrived_early": True}),
]

for event, extra in events:
    subject, page, text = build_email(event, booking, room_name, extra,
                                      room_type=room_type, image_url=image_url)
    suffix = "-early" if extra.get("arrived_early") else ""
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"email-preview-{event}{suffix}.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"{event}: {subject}")

print("previews written")
