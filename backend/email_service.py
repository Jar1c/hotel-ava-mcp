import html as _html
import json
import smtplib
import threading
import time
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from supabase import create_client, Client

from config import (
    SUPABASE_URL,
    SUPABASE_KEY,
    SUPABASE_SERVICE_KEY,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    MAIL_FROM,
    FRONTEND_URL,
)

HOTEL_NAME = "Hotel Ava"
HOTEL_PHONE = "+63 926 006 8565"
PLUM = "#82285f"
INK = "#2A2A28"
CANVAS = "#F4F6F8"
HAIRLINE = "#D5DADF"
HAIRLINE_SOFT = "#E6E9EE"
MUTED = "#7A7A70"
MUTED_SOFT = "#A3A8AF"
TEAL = "#455d58"
WHITE = "#FFFFFF"

_SENT: dict = {}
_SENT_TTL = 600

_client: Client = None


def _sb() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY or SUPABASE_KEY)
    return _client


def _esc(value) -> str:
    return _html.escape("" if value is None else str(value), quote=True)


def _fmt_date(value) -> str:
    if not value:
        return ""
    raw = str(value).split("T")[0]
    try:
        d = datetime.strptime(raw, "%Y-%m-%d")
        return f"{d.strftime('%a')}, {d.strftime('%b')} {d.day}, {d.year}"
    except ValueError:
        return str(value)


def _fmt_money(value) -> str:
    try:
        return f"₱{float(value):,.0f}"
    except (TypeError, ValueError):
        return "-"


def _from_addr() -> str:
    if MAIL_FROM and "<" in MAIL_FROM and ">" in MAIL_FROM:
        return MAIL_FROM
    return MAIL_FROM or SMTP_USER or "hotelava7@gmail.com"


def _first_image(value) -> str:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except Exception:
            return value if value.startswith("http") else ""
    if isinstance(value, list) and value:
        first = value[0]
        if isinstance(first, str) and first.startswith("http"):
            return first
    return ""


def _support_addr() -> str:
    return SMTP_USER or "hotelava7@gmail.com"


def _row(label, value) -> str:
    if value in (None, ""):
        return ""
    return (
        '<tr>'
        f'<td style="padding:11px 16px;font:400 13px Arial,sans-serif;color:{MUTED};'
        f'border-bottom:1px solid {HAIRLINE_SOFT};vertical-align:top;">{_esc(label)}</td>'
        f'<td style="padding:11px 16px;font:600 14px Arial,sans-serif;color:{INK};'
        f'border-bottom:1px solid {HAIRLINE_SOFT};text-align:right;vertical-align:top;">{value}</td>'
        "</tr>"
    )


def _subject(event: str, booking: dict) -> str:
    ref = f"#{booking.get('id', '')[:8]}"
    return {
        "confirmed": f"Your {HOTEL_NAME} booking is confirmed ({ref})",
        "cancelled": f"Your {HOTEL_NAME} booking was cancelled ({ref})",
        "refund": f"Refund initiated for your {HOTEL_NAME} booking ({ref})",
        "failed": f"Payment failed for your {HOTEL_NAME} booking ({ref})",
        "expired": f"Your {HOTEL_NAME} booking expired ({ref})",
    }.get(event, f"{HOTEL_NAME} booking update ({ref})")


def build_email(event: str, booking: dict, room_name: str, extra: dict = None,
                room_type: str = "", image_url: str = ""):
    extra = extra or {}
    ref = f"#{booking.get('id', '')[:8]}"
    first = (booking.get("full_name") or "").strip().split(" ")[0]
    who = first if first else "there"
    stay_type = booking.get("stay_type") or "overnight"
    check_in = booking.get("check_in") or ""
    check_out = booking.get("check_out") or ""
    start_time = booking.get("start_time") or ""
    duration = booking.get("duration") or ""
    total = booking.get("total_price")
    paid = booking.get("amount_paid")
    try:
        total_f = float(total or 0)
    except (TypeError, ValueError):
        total_f = 0.0
    try:
        paid_f = float(paid) if paid is not None else None
    except (TypeError, ValueError):
        paid_f = None

    guests_bits = []
    if booking.get("adults") is not None:
        guests_bits.append(f"{booking.get('adults')} adult{'s' if booking.get('adults') != 1 else ''}")
        if booking.get("children"):
            guests_bits.append(f"{booking.get('children')} child{'ren' if booking.get('children') != 1 else ''}")
        if booking.get("pets"):
            guests_bits.append(f"{booking.get('pets')} pet{'s' if booking.get('pets') != 1 else ''}")
    elif booking.get("guests"):
        g = booking.get("guests")
        try:
            guests_bits.append(f"{int(g)} guest{'s' if int(g) != 1 else ''}")
        except (TypeError, ValueError):
            guests_bits.append(str(g))

    check_in_row = _fmt_date(check_in)
    if stay_type == "day" and start_time:
        check_in_row = f"{check_in_row}, from {start_time}"
        if duration:
            check_in_row += f" ({duration} hrs)"

    stay_label = "Day use" if stay_type == "day" else "Overnight"
    if booking.get("stays"):
        stay_label = f"{stay_label} - {booking.get('stays')}"

    rows = ""
    rows += _row("Booking reference", _esc(ref))
    rows += _row("Room", _esc(room_name))
    if room_type:
        rows += _row("Room type", _esc(room_type))
    rows += _row("Check-in", _esc(check_in_row))
    if stay_type != "day" and check_out:
        rows += _row("Check-out", _esc(_fmt_date(check_out)))
    rows += _row("Stay", _esc(stay_label))
    if guests_bits:
        rows += _row("Guests", _esc(" - ".join(guests_bits)))
    rows += _row("Total", _fmt_money(total_f))
    if paid_f is not None and paid_f > 0:
        rows += _row("Paid so far", _fmt_money(paid_f))
        if total_f - paid_f > 0.5:
            rows += _row("Balance due at the hotel", _fmt_money(total_f - paid_f))

    if event == "refund":
        refund_amount = extra.get("refund_amount")
        if refund_amount is not None:
            rows += _row("Refund amount", _fmt_money(refund_amount))
        rows += _row("Arrives within", "7-14 banking days")

    banner_color = PLUM
    cta_label = "View my bookings"
    cta_href = f"{FRONTEND_URL}/my-bookings"

    if event == "confirmed":
        heading = "Booking confirmed"
        if paid_f is not None and paid_f + 0.5 >= total_f:
            banner = "Confirmed and paid in full"
        elif paid_f is not None and paid_f > 0:
            banner = "Confirmed - downpayment received"
        else:
            banner = "Your booking is confirmed"
        intro = f"Hi {who}, your stay at {HOTEL_NAME} is all set. Here are your booking details."
        note = "Please present this reference at the front desk upon arrival."
    elif event == "cancelled":
        heading = "Booking cancelled"
        banner = "This booking has been cancelled"
        banner_color = INK
        intro = f"Hi {who}, your booking for {room_name} has been cancelled."
        cta_label = "Book another stay"
        cta_href = f"{FRONTEND_URL}/rooms"
        note = "We hope to welcome you another time."
    elif event == "refund":
        heading = "Refund initiated"
        banner = "Your refund is on the way"
        banner_color = TEAL
        amount = extra.get("refund_amount")
        intro = (
            f"Hi {who}, a refund of {_fmt_money(amount)} for booking {_esc(ref)} "
            "has been initiated to your original payment method."
        )
        cta_label = "View my bookings"
        cta_href = f"{FRONTEND_URL}/my-bookings"
        note = "Refunds arrive within 7-14 banking days depending on your bank."
    elif event == "failed":
        heading = "Payment did not go through"
        banner = "Payment failed - booking cancelled"
        banner_color = INK
        intro = (
            f"Hi {who}, the payment for your booking on {_fmt_date(check_in)} "
            "did not complete, so the booking was cancelled. No charge was kept."
        )
        cta_label = "Try booking again"
        cta_href = f"{FRONTEND_URL}/rooms"
        note = "You can rebook the same room while it is still available."
    elif event == "expired":
        heading = "Booking expired"
        banner = "Unpaid booking auto-cancelled"
        banner_color = INK
        intro = (
            f"Hi {who}, your unpaid booking for {room_name} on {_fmt_date(check_in)} "
            "was automatically cancelled because payment was not received."
        )
        cta_label = "Book a stay"
        cta_href = f"{FRONTEND_URL}/rooms"
        note = "The room may still be available for your dates."
    else:
        heading = "Booking update"
        banner = "There is an update on your booking"
        intro = f"Hi {who}, here are your latest booking details for {room_name}."
        note = ""

    img_html = ""
    if image_url:
        img_html = (
            f'<img src="{_esc(image_url)}" alt="{_esc(room_name)}" width="536" height="200" '
            f'style="display:block;width:100%;max-width:536px;height:200px;object-fit:cover;'
            f'border-radius:12px;border:1px solid {HAIRLINE};margin:16px 0 0;background:{CANVAS};">'
        )

    cta = (
        f'<table cellspacing="0" cellpadding="0" style="margin:6px 0 4px;"><tr>'
        f'<td style="background:{PLUM};border-radius:12px;">'
        f'<a href="{_esc(cta_href)}" style="display:inline-block;padding:13px 26px;'
        f'font:700 14px Arial,sans-serif;color:{WHITE};text-decoration:none;border-radius:12px;">'
        f"{_esc(cta_label)}</a></td></tr></table>"
    )

    contact = (
        f'<p style="margin:18px 0 4px;font:400 13px Arial,sans-serif;color:{MUTED};">Questions? Contact {HOTEL_NAME}</p>'
        f'<p style="margin:0;font:600 14px Arial,sans-serif;">'
        f'<a href="tel:{_esc(HOTEL_PHONE.replace(" ", ""))}" style="color:{PLUM};text-decoration:none;">{_esc(HOTEL_PHONE)}</a>'
        f'<span style="color:{HAIRLINE};"> | </span>'
        f'<a href="mailto:{_esc(_support_addr())}" style="color:{PLUM};text-decoration:none;">{_esc(_support_addr())}</a>'
        "</p>"
    )

    note_html = (
        f'<p style="margin:16px 0 0;font:400 13px Arial,sans-serif;color:{MUTED_SOFT};">{_esc(note)}</p>'
        if note
        else ""
    )

    page = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{_esc(_subject(event, booking))}</title>
</head>
<body style="margin:0;padding:24px 12px;background:{CANVAS};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{CANVAS};">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:{WHITE};border:1px solid {HAIRLINE};border-radius:16px;">
<tr><td style="padding:32px 32px 28px;">
<p style="margin:0 0 18px;font:700 13px Arial,sans-serif;letter-spacing:4px;color:{PLUM};">{HOTEL_NAME.upper()}</p>
<h1 style="margin:0 0 8px;font:400 27px Georgia,'Times New Roman',serif;color:{PLUM};">{_esc(heading)}</h1>
<p style="margin:0 0 20px;font:400 14px Arial,sans-serif;line-height:1.55;color:{MUTED};">{_esc(intro)}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 6px;background:{banner_color};border-radius:12px;">
<tr><td style="padding:13px 16px;font:700 14px Arial,sans-serif;color:{WHITE};">{_esc(banner)}</td></tr>
</table>
{img_html}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 0;border:1px solid {HAIRLINE};border-radius:12px;border-collapse:separate;overflow:hidden;">
{rows}
</table>
{note_html}
{cta}
{contact}
</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid {HAIRLINE_SOFT};">
<p style="margin:0;font:400 12px Arial,sans-serif;line-height:1.5;color:{MUTED_SOFT};">
You are receiving this email because a booking was made for you at {HOTEL_NAME}. This is an automated message, please do not reply.
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""

    text_lines = [
        f"{HOTEL_NAME.upper()}",
        heading,
        banner,
        intro,
        "",
        f"Booking reference: {ref}",
        f"Room: {room_name}",
        f"Check-in: {check_in_row}",
    ]
    if room_type:
        text_lines.insert(text_lines.index(f"Room: {room_name}") + 1, f"Room type: {room_type}")
    if stay_type != "day" and check_out:
        text_lines.append(f"Check-out: {_fmt_date(check_out)}")
    text_lines.append(f"Stay: {stay_label}")
    if guests_bits:
        text_lines.append(f"Guests: {' - '.join(guests_bits)}")
    text_lines.append(f"Total: {_fmt_money(total_f)}")
    if paid_f is not None and paid_f > 0:
        text_lines.append(f"Paid so far: {_fmt_money(paid_f)}")
    if event == "refund" and extra.get("refund_amount") is not None:
        text_lines.append(f"Refund amount: {_fmt_money(extra.get('refund_amount'))}")
        text_lines.append("Arrives within: 7-14 banking days")
    if note:
        text_lines += ["", note]
    text_lines += ["", f"{cta_label}: {cta_href}", "", f"{HOTEL_PHONE} | {_support_addr()}"]

    return _subject(event, booking), page, "\n".join(text_lines)


def _send(to_addr: str, subject: str, page: str, text: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = _from_addr()
    msg["To"] = to_addr
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(page, "html", "utf-8"))
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    print(f"Email sent: {subject} -> {to_addr}")


_BOOKING_COLS = (
    "id, user_id, room_id, check_in, check_out, guests, full_name, email, phone, "
    "total_price, status, payment_method, stay_type, stays, start_time, duration"
)
_BOOKING_COLS_EX = _BOOKING_COLS + ", amount_paid, payment_mode, adults, children, pets"


def send_booking_email(event: str, booking_id: str, **extra):
    try:
        if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD):
            print("Email skipped: SMTP is not configured in .env")
            return
        if not booking_id:
            return
        key = (booking_id, event)
        now = time.time()
        if key in _SENT and now - _SENT[key] < _SENT_TTL:
            return
        _SENT[key] = now

        sb = _sb()
        booking = None
        try:
            res = sb.table("bookings").select(_BOOKING_COLS_EX).eq("id", booking_id).execute()
            booking = res.data[0] if res.data else None
        except Exception:
            res = sb.table("bookings").select(_BOOKING_COLS).eq("id", booking_id).execute()
            booking = res.data[0] if res.data else None
        if not booking:
            return

        recipient = (booking.get("email") or "").strip()
        if not recipient:
            try:
                ures = sb.table("users").select("email").eq("id", booking.get("user_id")).execute()
                recipient = (ures.data[0].get("email") or "").strip() if ures.data else ""
            except Exception:
                recipient = ""
        if not recipient:
            return

        room_name = "your room"
        room_type = ""
        image_url = ""
        if booking.get("room_id"):
            try:
                rres = sb.table("rooms").select("name, type, images").eq("id", booking["room_id"]).execute()
                if rres.data:
                    rr0 = rres.data[0]
                    room_name = rr0.get("name") or room_name
                    room_type = rr0.get("type") or ""
                    image_url = _first_image(rr0.get("images"))
            except Exception:
                pass

        subject, page, text = build_email(event, booking, room_name, extra,
                                          room_type=room_type, image_url=image_url)
        threading.Thread(target=_send, args=(recipient, subject, page, text), daemon=True).start()
    except Exception as e:
        print(f"Email error ({event} {booking_id}): {e}")
