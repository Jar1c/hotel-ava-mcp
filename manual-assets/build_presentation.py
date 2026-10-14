# -*- coding: utf-8 -*-
"""Builds the Hotel Ava LIVE DEMO SCRIPT (English,30 minutes,4 presenters).

Run:  uv run --with python-docx manual-assets/build_presentation.py
Out:  Hotel Ava - Demo Presentation Script.docx
"""
from pathlib import Path
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

PLUM = RGBColor(0x82, 0x28, 0x5F)
TEAL = RGBColor(0x45, 0x5D, 0x58)
GRAY = RGBColor(0x66, 0x66, 0x66)
CENTER = WD_ALIGN_PARAGRAPH.CENTER

ASSETS = Path(__file__).resolve().parent
OUT = ASSETS.parent / "Hotel Ava - Demo Presentation Script.docx"

doc = Document()
normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(11)
for hname, sz in [("Title", 40), ("Heading 1", 18), ("Heading 2", 14), ("Heading 3", 12)]:
    st = doc.styles[hname]
    st.font.name = "Calibri"
    st.font.size = Pt(sz)
    st.font.color.rgb = PLUM


def rich(p, text, size=None, italic=False, color=None):
    for i, part in enumerate(text.split("**")):
        if not part:
            continue
        r = p.add_run(part)
        r.bold = (i % 2 == 1)
        r.italic = italic
        if size:
            r.font.size = Pt(size)
        if color:
            r.font.color.rgb = color
    return p


def para(text, size=None, space_after=6, align=None, indent=0.0):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    if indent:
        p.paragraph_format.left_indent = Inches(indent)
    if align is not None:
        p.alignment = align
    return rich(p, text, size=size)


def bullets(items, indent=0.3):
    for s in items:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(indent)
        p.paragraph_format.space_after = Pt(3)
        rich(p, "\u2022  " + s)


def steps(items, indent=0.3):
    for i, s in enumerate(items, 1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(indent)
        p.paragraph_format.space_after = Pt(3)
        rich(p, f"{i}.  {s}")


def gd(kind, text, indent=0.45):
    """DO / SAY callout line."""
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(indent)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run("DO:    " if kind == "g" else "SAY:   ")
    r.bold = True
    r.font.color.rgb = TEAL if kind == "g" else PLUM
    return rich(p, text)


def note(text, indent=0.45, color=None):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(indent)
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run("NOTE:  ")
    r.bold = True
    r.font.color.rgb = color or GRAY
    return rich(p, text, size=10, color=color or GRAY)


def h1(t):
    doc.add_heading(t, level=1)


def h2(t):
    doc.add_heading(t, level=2)


def h3(t):
    doc.add_heading(t, level=3)


def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), hexcolor)
    tcPr.append(shd)


def table(headers, rows, widths=None, header_fill="82285F"):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = "Table Grid"
    for j, h in enumerate(headers):
        c = t.rows[0].cells[j]
        c.text = ""
        p = c.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        shade(c, header_fill)
    for i, row in enumerate(rows, 1):
        for j, val in enumerate(row):
            c = t.rows[i].cells[j]
            c.text = ""
            p = c.paragraphs[0]
            rich(p, val, size=10)
            if i % 2 == 0:
                shade(c, "F6F1F5")
    if widths:
        for j, w in enumerate(widths):
            for row in t.rows:
                row.cells[j].width = Inches(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def page_break():
    doc.add_page_break()


# ---------------------------------------------------------------- title page
for _ in range(6):
    doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = CENTER
r = p.add_run("HOTEL AVA"); r.bold = True; r.font.size = Pt(46); r.font.color.rgb = PLUM

p = doc.add_paragraph(); p.alignment = CENTER
r = p.add_run("LIVE DEMO SCRIPT"); r.bold = True; r.font.size = Pt(24); r.font.color.rgb = TEAL

p = doc.add_paragraph(); p.alignment = CENTER
r = p.add_run("30-Minute System Walkthrough  \u2014  Guest Side, Admin Side & AI")
r.italic = True; r.font.size = Pt(14); r.font.color.rgb = GRAY

doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = CENTER
r = p.add_run("English  |  4 Presenters  |  Every step is LIVE  |  October 2026")
r.font.size = Pt(11)

page_break()

# ---------------------------------------------------------------- overview
h1("Demo at a Glance")
para("This demo is a **live walkthrough** \u2014 every click runs the real system. The goal is simple: "
     "show the panel that **Hotel Ava is fully working**, from signing in all the way to AI-powered insights.")

h2("30-Minute Flow")
table(
    ["#", "Segment", "Presenter", "Time"],
    [
        ["1", "**Introduction & Home**", "Person 1  _________________", "4 min"],
        ["2", "**Guest Side** \u2014 sign-in (3 ways), booking, Ask Ava", "Person 2  _________________", "9 min"],
        ["3", "**Admin Side** \u2014 dashboard, walk-in, operations", "Person 3  _________________", "9 min"],
        ["4", "**AI Features** + wrap-up + Q&A", "Person 4  _________________", "8 min"],
        ["", "**TOTAL", "", "**30 min"],
    ],
    widths=[0.4, 3.3, 2.4, 0.8],
)

h2("Three Ways to Sign In (demo highlight)")
table(
    ["Method", "How it works", "What to say"],
    [
        ["**Continue with Google", "One click with any Google account.", "\u201cSign in with your Google account \u2014 one click, no forms.\u201d"],
        ["**Sign in with Email", "Classic email + password. Email is verified, and new devices get a one-time code.",
         "\u201cYour email and password \u2014 with verification for your safety.\u201d"],
        ["**Quick Sign-In (QR)", "The signed-out device shows a QR + a 5-minute code. Approve it from "
         "Settings \u2192 Quick Sign-In on a device where you are already signed in \u2014 and this device signs in instantly.",
         "\u201cScan the QR with your phone and approve \u2014 no typing at all.\u201d"],
    ],
    widths=[1.5, 3.4, 2.0],
)

h2("Before the Demo \u2014 Checklist")
steps([
    "**Set up the system beforehand.** The app must already be open and working at "
    "`http://localhost:5173` \u2014 nothing gets launched in front of the panel.",
    "**Prepare the three sign-ins:** a Google account already signed in on the demo browser, a phone "
    "with the guest account already signed in (for the Quick Sign-In QR), and the email account below.",
    "**Open two tabs:** Tab 1 = guest side (Home page), Tab 2 = admin (Dashboard).",
    "Go fullscreen (F11), zoom to about 110%, and close extra tabs.",
    "Pick the room and time you will use for the double-booking demo (Person 3) \u2014 write it down.",
])

h2("Accounts")
table(
    ["Panel", "Login", "Password", "Note"],
    [
        ["**Guest (User side)", "mosjaric@gmail.com", "Calderon143", "Use this for the live sign-in; if a code is "
                                                                     "requested, switch to the pre-logged tab."],
        ["**Admin", "hotelava7@gmail.com", "Hotelava123", "Sign in at `/admin`"],
        ["*Fallback admin", "manual.admin@hotelava-demo.com", "HotelAvaManual2026", "In case the main admin is locked"],
    ],
    widths=[1.4, 2.2, 1.5, 1.8],
)
note("Both are also saved in `account-info.txt`. Never sign in live on stage if it can be avoided \u2014 "
     "keep a pre-logged tab as backup.")

page_break()

# ---------------------------------------------------------------- person 1
h1("Person 1 \u2014 Introduction & Home (4 min)")
para("**Goal:** Set the stage and show the landing page. **Keep it short** \u2014 the demo is the star.")

gd("g", "Open the **Home page** and leave it on screen while you talk.")
gd("s", "\u201cGood day! We are Team ______, and this is **Hotel Ava** \u2014 a smart hotel reservation "
        "and recommendation system. In the next 30 minutes we will walk you through the **guest side**, "
        "the **admin side**, and the **AI** that powers both \u2014 all running live.\u201d")
gd("g", "Point at the **hero banner**, the **search bar**, and the **featured rooms**.")
gd("s", "\u201cGuests can search rooms in real time. Everything you see \u2014 availability, prices, reviews "
        "\u2014 comes straight from the live database.\u201d")

h3("Quick Feature Map (one breath each)")
bullets([
    "**Booking** \u2014 overnight stays and **day use** by the hour.",
    "**Payments** \u2014 full payment or 50% downpayment through PayMongo, with automatic refunds.",
    "**Check-in** \u2014 QR codes for online bookings, **auto check-in** for walk-ins.",
    "**Protection** \u2014 **double bookings are impossible** (Person 3 will prove it live).",
    "**AI** \u2014 Ask Ava for guests, an AI Assistant for management.",
])

gd("s", "\u201cFirst the guest experience \u2014 over to Person 2.\u201d")

page_break()

# ---------------------------------------------------------------- person 2
h1("Person 2 \u2014 Guest (User) Side (9 min)")
para("**Precondition:** Tab 1 is on the Home page; account details are ready.")

h2("Step 1 \u2014 Sign In (3 Ways)")
gd("g", "Click **Sign In** in the header \u2014 the sign-in window opens.")
gd("s", "\u201cWe offer **three ways to sign in** \u2014 Google, email, and Quick Sign-In.\u201d")
gd("g", "Point at each option as you name it:")
bullets([
    "**Continue with Google** \u2014 \u201cone click with your Google account.\u201d",
    "**Sign in with Email** \u2014 \u201cemail and password, with email verification and a one-time code on "
    "new devices.\u201d",
    "**Quick Sign-In (QR)** \u2014 \u201cthis device shows a QR code and a 5-minute code; I approve it from my "
    "phone under Settings \u2192 Quick Sign-In, and the browser signs in instantly. No typing at all.\u201d",
])
gd("g", "**Sign in live** using the prepared method (email or Google).")
note("If anything blocks the live sign-in (one-time code, network), just switch to the pre-logged tab "
     "\u2014 say \u201cwe are already signed in here\u201d and continue. Never stall on stage.")

h2("Step 2 \u2014 Search Rooms")
gd("g", "Go to **Rooms**. Set the **dates**, then use the filters: room type, price, guests.")
gd("s", "\u201cAvailability is real time. If a room is taken for your dates, it simply will not show as "
        "available.\u201d")

h2("Step 3 \u2014 Room Details")
gd("g", "Open one room. Show the **photo gallery**, **amenities**, **guest reviews**, house rules, and the rate.")
gd("s", "\u201cEverything a guest needs to decide \u2014 including real reviews from previous stays.\u201d")

h2("Step 4 \u2014 Make a Booking")
gd("g", "Click **Book Now**. Choose **Overnight** (dates) or **Day Use** (time slots \u2014 past hours are "
        "locked, occupied slots are marked). Set the number of guests.")
gd("g", "Show the **price breakdown**: rate + **12% tax** = total. Point at the **AI discount code** field, "
        "then the two payment options: **Full payment** or **Downpayment (50%)**.")
gd("s", "\u201cNo hidden fees \u2014 the breakdown shows everything. Guests can pay in full or just 50% now "
        "and settle the balance at the hotel, all processed securely through PayMongo.\u201d")
note("Stopping at the breakdown is perfectly fine \u2014 the panel does not need to see a real payment. "
     "If you do continue, the PayMongo test page opens; just cancel out of it.", color=PLUM)

h2("Step 5 \u2014 My Bookings")
gd("g", "Open **Account \u2192 My Bookings**. Show the status badges (Confirmed, In-house, Completed, "
        "Cancelled). Open a booking to show its **QR code**, then point at **Cancel** and **Extend stay**.")
gd("s", "\u201cEvery booking carries a QR code for quick check-in. Guests can cancel up to 24 hours ahead "
        "for an automatic refund \u2014 and notice that **only the guest can cancel**; the admin cannot "
        "override someone's booking.\u201d")

h2("Step 6 \u2014 Notifications & Profile")
gd("g", "Click the **bell icon** (notifications), then open the **Account** menu briefly.")
gd("s", "\u201cGuests get updates automatically, and the account area covers profile, password, and settings.\u201d")

h2("Step 7 \u2014 Ask Ava (Guest AI)")
gd("g", "Open the **Ask Ava** chat at the bottom-right and ask live, for example: "
        "\u201cWhat is the best room for two guests this weekend?\u201d")
gd("s", "\u201c**Ask Ava** is our AI assistant. It answers using the hotel's **real data** \u2014 rooms, "
        "prices, availability \u2014 not canned replies.\u201d")

gd("s", "\u201cThat is the guest side. Now let's see how the hotel manages all of this \u2014 over to Person 3.\u201d")

page_break()

# ---------------------------------------------------------------- person 3
h1("Person 3 \u2014 Admin Side (9 min)")
para("**Precondition:** Tab 2 is on the admin Dashboard.")

h2("Step 1 \u2014 Admin Portal")
gd("g", "Sign in at **`/admin`** with the admin account (or use the already-logged tab).")
gd("s", "\u201cThe admin has a **separate portal** and separate rights from a regular guest.\u201d")

h2("Step 2 \u2014 Dashboard")
gd("g", "Show the **stat cards** (bookings, revenue, occupancy), the **charts**, the **AI insight strip**, "
        "and the **New Booking** and **Scan booking** buttons.")
gd("s", "\u201cThis is the hotel at a glance \u2014 live numbers straight from the database \u2014 plus AI "
        "insight cards summarizing the next 30 days.\u201d")

h2("Step 3 \u2014 Bookings")
gd("g", "Open **Bookings**. Search and filter; hover a row to reveal the actions: **View**, **Check In**, "
        "**Complete**, QR.")
gd("s", "\u201cEvery booking in one table \u2014 online and walk-in. One important design choice: the admin "
        "**cannot cancel** a booking. Cancellation always belongs to the guest who made it.\u201d")

h2("Step 4 \u2014 Walk-in Booking (highlight)")
gd("g", "Click **New Booking** and walk through the dialog:")
steps([
    "Pick a **room** \u2014 room cards show images, and occupied rooms carry a **BOOKED** chip.",
    "Choose **Overnight** or **Day Use** \u2014 past hours are locked to the current time.",
    "Set guests \u2014 values are clamped to the room's capacity automatically.",
    "Show **Payment: Cash** (fixed, no dropdown) and the **price breakdown** \u2014 identical to the guest "
    "side, including the **12% tax**.",
    "Click **Create booking**.",
])
gd("g", "After creation, show the success message and the booking in the table with status **IN-HOUSE**.")
gd("s", "\u201cA walk-in guest is standing at the counter \u2014 so the system **checks them in "
        "automatically**. No QR to scan, no extra clicks: in-house the moment the booking is created. "
        "Cash is the default at the counter.\u201d")

h2("Step 5 \u2014 Double-Booking Guard (wow moment)")
gd("g", "Try to book the **same room, same day and time** again. **Expected result: it is blocked** with "
        "\u201cRoom is not available for the selected dates.\u201d")
gd("s", "\u201cThe system itself refuses overlapping bookings \u2014 this is enforced by the **data**, not "
        "just the interface. Even if two guests submit at the exact same moment, only one booking can go "
        "through. It covers overnight **and** day use \u2014 and you can try it from the guest side too, "
        "with the same result.\u201d")
note("Pause for a second here \u2014 this is the strongest proof of a working system. If time allows, "
     "repeat the attempt from the guest tab for a double confirmation.", color=PLUM)

h2("Step 6 \u2014 Operations (fast tour)")
bullets([
    "**Rooms** \u2014 inventory, rates, and photos of every room.",
    "**Calendar** \u2014 who is staying today and who is arriving.",
    "**Guests** \u2014 the directory of registered guests.",
    "**Reviews** \u2014 moderation: approve or reject guest reviews.",
])

gd("s", "\u201cFinally, the part we are most proud of \u2014 the AI. Over to Person 4.\u201d")

page_break()

# ---------------------------------------------------------------- person 4
h1("Person 4 \u2014 AI Features + Wrap-up (8 min)")

h2("Part A \u2014 Admin AI Assistant (main highlight, ~4 min)")
gd("g", "Open **AI Assistant** in the admin sidebar.")
gd("s", "\u201cThis is where the AI works for management \u2014 every insight is computed from the hotel's "
        "**own booking history**, more than 1,300 bookings.\u201d")

h3("Tab 1 \u2014 Smart Forecast")
gd("g", "Show the **occupancy** and **revenue** forecast charts, plus the accuracy and growth figures.")
gd("s", "\u201cThe AI predicts **how full the hotel will be** and the **expected revenue** for the coming "
        "months \u2014 so the management can plan staff, rates, and promotions ahead of time.\u201d")

h3("Tab 2 \u2014 Discounts")
gd("g", "Show the **AI-suggested discounts**: rooms with weak bookings, holiday promos, and scheduled "
        "price cuts with ready-to-use codes.")
gd("s", "\u201cThe AI **detects rooms that are not selling** and suggests targeted discounts \u2014 holiday "
        "promos and scheduled price cuts \u2014 each with a code the guest can use at checkout.\u201d")
note("If time allows: copy a suggested discount code, switch to the guest tab, and apply it in the booking "
     "page \u2014 the panel sees the AI suggestion become a real discount.", color=PLUM)

h3("Tab 3 \u2014 Hotel Stats")
gd("g", "Show **seasonal trends**, **room performance**, and the key takeaways.")
gd("s", "\u201cSeasonal trends, which rooms perform best, and key takeaways \u2014 all generated from the "
        "booking records, updated as new bookings come in.\u201d")

gd("g", "Point back at the **Dashboard AI cards**.")
gd("s", "\u201cAnd back on the dashboard, the AI cards give a rolling 30-day snapshot: occupancy, revenue "
        "growth, and discount ideas.\u201d")

h2("Part B \u2014 AI on Both Sides (~1 min)")
bullets([
    "**Guest side:** Ask Ava answers questions and recommends rooms from real data (Person 2 just showed it).",
    "**Admin side:** Smart Forecast, AI Discounts, and Hotel Stats guide management decisions.",
])
gd("s", "\u201cAI on both sides \u2014 it helps guests choose, and it helps management decide.\u201d")

h2("Part C \u2014 Why You Can Trust It (~1.5 min)")
bullets([
    "**Real data** \u2014 every number on screen comes from the live database, not mockups.",
    "**Double-booking protection** \u2014 enforced at the data level; Person 3 showed it live.",
    "**Secure accounts** \u2014 Google, verified email, one-time codes on new devices, and Quick Sign-In QR.",
    "**Payments** \u2014 PayMongo handles full payments and downpayments, with automatic refunds on "
    "cancellations made 24+ hours ahead.",
])

h2("Part D \u2014 Wrap-up & Q&A (~1.5 min)")
gd("s", "\u201cEverything you saw was **live** \u2014 signing in, booking, walk-ins, and the AI. "
        "Thank you \u2014 we are happy to take your questions.\u201d")

h3("Q&A Cheat Sheet")
table(
    ["If they ask...", "Answer"],
    [
        ["**\u201cWhy 1,305 total bookings but only 1,104 in the AI stats?\u201d**",
         "The total includes **201 cancelled** bookings. The AI uses **active bookings only** \u2014 so "
         "forecasts, revenue, and room rankings stay accurate."],
        ["**\u201cHow exactly do you prevent double bookings?\u201d**",
         "Every booking has a **time window**. Before a new one is accepted, the system checks the window, "
         "and the **data layer rejects overlaps** \u2014 even if two guests submit at the same instant. "
         "Covers overnight and day use, and it was shown live earlier."],
        ["**\u201cWhat can the AI actually do?\u201d**",
         "Two sides: **Ask Ava** answers guests from real data; the **AI Assistant** gives management a "
         "Smart Forecast (occupancy + revenue), AI-suggested discounts, and hotel stats \u2014 plus AI "
         "discount codes at checkout."],
        ["**\u201cAre the payments secure?\u201d**",
         "PayMongo processes every payment \u2014 the system never touches card details. Refunds are "
         "automatic for cancellations made 24+ hours ahead (7\u201314 banking days)."],
        ["**\u201cDoes it work on phones?\u201d**",
         "Yes \u2014 the whole system is responsive, including mobile navigation and the booking flow."],
    ],
    widths=[2.6, 4.4],
)

page_break()

# ---------------------------------------------------------------- troubleshooting
h1("Troubleshooting During the Demo")
table(
    ["If this happens...", "Do this"],
    [
        ["**Blank or error page**", "Refresh (Ctrl+Shift+R). The system must be set up before the demo."],
        ["**Signed out mid-demo**", "Use the pre-logged tab \u2014 sign-ins should happen before the presentation."],
        ["**One-time code / verification prompt**", "That is new-device protection. Switch to the pre-logged "
                                                    "tab instead of codes on stage."],
        ["**Numbers take a few seconds to update**", "Normal \u2014 data refreshes shortly. Move a filter "
                                                     "and come back."],
        ["**\u201cRoom not available\u201d during the conflict demo**", "**Expected! That is the double-booking "
                                                                        "protection doing its job.**"],
        ["**PayMongo page opens**", "Cancel out of it \u2014 no real payment is needed during the demo."],
        ["**A demo booking was created**", "Write down the room and date; remove it right after the demo."],
    ],
    widths=[2.6, 4.4],
)

h2("30-Second Refresher (read aloud before starting)")
steps([
    "**P1:** Welcome \u2192 Home highlights \u2192 feature map \u2192 hand over to P2.",
    "**P2:** Sign in (**3 ways!**) \u2192 Rooms \u2192 Room page \u2192 Booking breakdown \u2192 "
    "My Bookings + QR \u2192 **Ask Ava**.",
    "**P3:** Admin portal \u2192 Dashboard \u2192 Bookings \u2192 **Walk-in (cash + auto in-house)** \u2192 "
    "**Conflict = BLOCKED** \u2192 operations tour.",
    "**P4:** **AI Assistant (Forecast, Discounts, Stats)** \u2192 AI on both sides \u2192 trust bullets \u2192 "
    "\u201cEverything was live\u201d \u2192 Q&A.",
])

doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = CENTER
r = p.add_run("Good luck with your demo \u2014 you've got this!")
r.italic = True; r.font.size = Pt(13); r.font.color.rgb = PLUM

doc.save(str(OUT))
print(f"Saved: {OUT}")
