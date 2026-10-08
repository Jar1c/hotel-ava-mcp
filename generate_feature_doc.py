"""Generate a simple, plain, English version of the Hotel Ava feature-change document.

Usage: python generate_feature_doc.py   (requires: python-docx)
"""

from docx import Document
from docx.shared import Pt, RGBColor

BLACK = RGBColor(0x00, 0x00, 0x00)


def heading(doc, text, level):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.color.rgb = BLACK  # plain black, no colors
    return h


def table(doc, headers, rows):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    for i, text in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = ""
        r = cell.paragraphs[0].add_run(text)
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = BLACK
    for row in rows:
        cells = t.add_row().cells
        for i, text in enumerate(row):
            cells[i].text = ""
            r = cells[i].paragraphs[0].add_run(text)
            r.font.size = Pt(10)
            r.font.color.rgb = BLACK
    doc.add_paragraph()


doc = Document()

# ── Title (plain black) ──────────────────────────────────────────────────
title = doc.add_heading("Hotel Ava - Feature Changes and Additions", level=0)
for run in title.runs:
    run.font.color.rgb = BLACK
sub = doc.add_paragraph()
r = sub.add_run("Original documentation vs. current system | October 8, 2026")
r.italic = True
r.font.color.rgb = BLACK

# ── 1. User Roles ────────────────────────────────────────────────────────
heading(doc, "1. User Roles", 1)
table(
    doc,
    ["Role", "What Changed", "Status"],
    [
        [
            "Guest",
            "Same as before: browse, search, and filter rooms; must register to book. "
            "Added: email verification before booking, Google sign-in, Quick Sign-In.",
            "Retained, expanded",
        ],
        [
            "Registered User",
            "Same as before: book, extend, cancel, manage profile, view confirmations "
            "and records, receive room suggestions. Added: receipts, reviews, "
            "notifications, day-use bookings, account security settings.",
            "Retained, expanded",
        ],
        [
            "Administrator",
            "Same as before: manage rooms, reservations, availability, payments, user "
            "accounts, trends, occupancy, revenue, and predictive insights. Added: "
            "AI Insights, discount management, calendar, review moderation.",
            "Retained, expanded",
        ],
    ],
)

# ── 2. The 11 Major Functionalities ──────────────────────────────────────
heading(doc, "2. The 11 Major Functionalities", 1)
table(
    doc,
    ["#", "Functionality", "Status", "Key Changes"],
    [
        ["1", "Registration, login, role-based access", "Enhanced",
         "Email verification, Google sign-in, OTP login challenge, Quick Sign-In, "
         "password reset, device and session management."],
        ["2", "Room management (price, availability, capacity, amenities)", "Enhanced",
         "Full admin CRUD; day-use rates (3/6/8/12 hrs); image upload."],
        ["3", "Room search and filtering (price, guests, amenities, dates)", "Enhanced",
         "Relevance ranking and instant price quotes added."],
        ["4", "Reservation management (book, change, cancel, live availability)", "Enhanced",
         "Conflict check (no double-booking), check-in, auto-complete, paid extensions."],
        ["5", "Hosted checkout payment (GCash, Maya, QR Ph, card) with status", "Retained",
         "PayMongo checkout + webhook; added payment retry, downpayment, balance settlement."],
        ["6", "Billing and e-invoicing after payment verification", "Retained",
         "Official receipt view; payment verified before confirmation."],
        ["7", "Cancellation and refund management", "Enhanced",
         "Automatic refund policy (24-hour rule); refund records stored."],
        ["8", "AI room recommendations (guest) + ML recommendations (admin)", "Expanded",
         "Guest room ranking and alternatives; admin AI Insights for demand, discounts, forecast."],
        ["9", "Predictive analytics for prices and promotions", "Enhanced",
         "Occupancy and revenue forecasts, forecast accuracy, seasonal analysis."],
        ["10", "Admin dashboard (reservations, occupancy, revenue, trends)", "Enhanced",
         "Added Calendar, Guests, Reviews, Discounts, AI Insights, Analytics pages."],
        ["11", "Web access on desktop, tablet, and phone", "Retained",
         "Responsive web app; still no mobile app."],
    ],
)

# ── 3. New Features (not in the original document) ───────────────────────
heading(doc, "3. New Features (Not in the Original Document)", 1)
new_features = [
    "Auth: email verification, complete-registration flow, Google sign-in.",
    "Auth: OTP login challenge for new devices or locations.",
    "Auth: Quick Sign-In - approve a short code from another signed-in device.",
    "Auth: device and session management, forgot/reset password, account deletion.",
    "Booking: day-use stays (3, 6, 8, or 12 hours) alongside overnight stays.",
    "Booking: paid extensions, downpayment and balance settlement.",
    "Booking: price quotes before booking; alternative rooms when a room is full.",
    "Booking: auto-complete of finished stays and stay reminders.",
    "Payments: PayMongo webhook for live payment status; payment retry.",
    "Payments: automatic refunds under the 24-hour cancellation policy.",
    "Communication: in-app notifications for guests and admins.",
    "Communication: reviews and ratings (guest posts, admin replies, featured reviews).",
    "Admin: AI Insights page (demand insights, discount offers, forecast accuracy).",
    "Admin: discount management with audit trail; availability calendar.",
    "Admin: review moderation and guest directory.",
]
for item in new_features:
    p = doc.add_paragraph(item, style="List Bullet")
    for run in p.runs:
        run.font.color.rgb = BLACK

# ── 4. Limitations ───────────────────────────────────────────────────────
heading(doc, "4. Limitations", 1)
table(
    doc,
    ["Limitation (from the original document)", "Status", "Detail"],
    [
        ["Single language only", "Still applies",
         "No language switcher in the interface."],
        ["Payment credentials are not stored; depends on the payment provider", "Still applies",
         "PayMongo hosted checkout; only payment status and reference are recorded."],
        ["Predictions use historical data only", "Still applies",
         "Forecast models use past bookings and revenue; no external market signals."],
        ["Content-based recommendations only; no collaborative filtering", "Still applies",
         "Room ranking uses fit scores; no collaborative filtering implemented."],
        ["New database; no migration of old records", "Still applies (detail changed)",
         "Now Supabase (PostgreSQL) with schema migration scripts, but still no import "
         "of legacy records."],
        ["Web only; no mobile app", "Still applies",
         "Responsive web app only."],
    ],
)

# ── 5. Summary ───────────────────────────────────────────────────────────
heading(doc, "5. Summary", 1)
for item in [
    "All 11 functionalities are still present: 7 enhanced, 4 retained as-is.",
    "All 3 user roles retained and expanded.",
    "15+ new features added (security, booking, payments, reviews, admin tools).",
    "5 of 6 limitations still apply; only the database limitation changed in detail.",
]:
    p = doc.add_paragraph(item, style="List Bullet")
    for run in p.runs:
        run.font.color.rgb = BLACK

OUT = r"D:\download\Capstone2\Hotel Ava\Hotel_Ava_Feature_Updates_v2.docx"
doc.save(OUT)

# Verify by reading it back.
check = Document(OUT)
print(f"Saved: {OUT}")
print(f"Paragraphs: {len(check.paragraphs)}, Tables: {len(check.tables)}")


