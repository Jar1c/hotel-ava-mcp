# -*- coding: utf-8 -*-
"""Builds the Hotel Ava DEMO PRESENTATION SCRIPT (Taglish, 4 persons).

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
RED = RGBColor(0xB0, 0x3A, 0x3A)
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
    """GAWIN / SABIHIN callout line."""
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(indent)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run("GAWIN:  " if kind == "g" else "SABIHIN:  ")
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
r = p.add_run("DEMO PRESENTATION SCRIPT"); r.bold = True; r.font.size = Pt(24); r.font.color.rgb = TEAL

p = doc.add_paragraph(); p.alignment = CENTER
r = p.add_run("Para sa 4-Man Team  \u2014  User Side at Admin Side Live Demo")
r.italic = True; r.font.size = Pt(14); r.font.color.rgb = GRAY

doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = CENTER
r = p.add_run("Taglish Script  |  ~18\u201320 minutes  |  October 2026")
r.font.size = Pt(11)

page_break()

# ---------------------------------------------------------------- how to use
h1("Paano Gamitin ang Script na Ito")
para("Ito ay **handa nang script** para sa presentasyon \u2014 hati sa **4 na tao**. Ang bawat segment ay may "
     "**GAWIN** (ang iki-click / aksyon sa screen) at **SABIHIN** (ang sasabihin sa audience, Taglish ok lang). "
     "Ipalit lang ang mga pangalan sa table sa ibaba bago ang demo.")
bullets([
    "**GAWIN** = i-click ang nakasulat, sa eksaktong pagkakasunod-sunod.",
    "**SABIHIN** = copy-catch lang \u2014 pwedeng sabihin ng sarili mong salita, basta nasa puntos.",
    "**NOTE** = paalala para hindi matigil ang demo.",
    "Huwag mag-on ng mic check sa screen \u2014 nakaprepare na ang lahat bago magsimula.",
])

h2("Sino ang Magpapakita ng Ano")
table(
    ["Role", "Pangalan", "Segment", "Tagal"],
    [
        ["**Person 1** \u2014 Panimula", "_________________", "Overview, problem \u2192 solution, bridge", "2\u20133 min"],
        ["**Person 2** \u2014 User Side", "_________________", "Guest flow: home \u2192 booking \u2192 Ask Ava", "5\u20136 min"],
        ["**Person 3** \u2014 Admin Side", "_________________", "Dashboard, walk-in, double-booking guard", "6 min"],
        ["**Person 4** \u2014 Tech + Q&A", "_________________", "Architecture, AI, security, Q&A", "3\u20134 min"],
        ["**TOTAL", "", "Buong demo + Q&A", "**~18\u201320 min"],
    ],
    widths=[1.9, 1.6, 2.5, 0.9],
)

h2("Checklist \u2014 BAGO Magsimula ang Demo")
steps([
    "Sa terminal sa `D:\\HotelAva`, patakbuhin ang **`npm run dev`** \u2014 sabay ang Flask (`:5000`) at Vite (`:5173`). Hintayin ang **\u201cVITE ready\u201d** at **\u201cDebugger is active\u201d**.",
    "Browser \u2192 `http://localhost:5173` \u2014 **hard refresh** (Ctrl+Shift+R).",
    "**Mag-login NA BAGO ang demo**: Tab 1 = Guest account (User side), Tab 2 = Admin sa `/admin`. "
    "Kapag bagong device nag-login ang guest, hihingan siya ng **OTP** \u2014 kaya i-prepare nang maaga, huwag na live sa harap ng audience.",
    "I-fullscreen ang browser (F11), zoom ~110%, isara ang ibang tabs.",
    "Optional: phone camera para sa **QR scan** demo (admin \u2192 Scan booking).",
    "I-launch ang Tab 1 sa **Home page**, Tab 2 sa **Dashboard** \u2014 naka-standby na.",
])

h2("Mga Account na Gagamitin")
table(
    ["Panel", "Login", "Password", "Tala"],
    [
        ["**Guest (User side)**", "mosjaric@gmail.com", "Calderon143", "Naka-login na dapat bago mag-demo (OTP kapag new device!)"],
        ["**Admin**", "hotelava7@gmail.com", "Hotelava123", "Login sa `/admin`"],
        ["*Fallback admin*", "manual.admin@hotelava-demo.com", "HotelAvaManual2026", "Kung ma-lock ang admin account"],
    ],
    widths=[1.4, 2.2, 1.5, 2.0],
)
note("Parehong naka-save sa `account-info.txt`. Huwag nang mag-live login sa harap ng audience.")

page_break()

# ---------------------------------------------------------------- person 1
h1("Person 1 \u2014 Panimula (2\u20133 min)")
para("**Bago magsalita:** naka-standby na ang Tab 1 sa Home page.")

gd("g", "I-cursor lang ang Home page habang nagsasalita \u2014 ipakita ang hero banner at mga room card.")
gd("s", "\u201cMagandang araw po! Kami ang grupo ng **Hotel Ava** \u2014 ang **Smart Hotel Reservation and "
        "Recommendation System** namin. Ipapakita namin sa inyo ang buong sistema mula sa panig ng **guest** "
        "at ng **admin**.\u201d")
gd("s", "\u201cAng problema sa mga hotel ngayon: **manual logbook**, **double booking**, hirap i-track sino ang "
        "naka-check-in. Ang solusyon namin: isang **web system** na real-time ang availability, online ang "
        "booking, at may **AI** na tumutulong sa guest at sa management.\u201d")

h3("Ano ang Technology sa Likod (sabihin nang mabilis)")
bullets([
    "**Frontend:** React + TypeScript + Tailwind CSS \u2014 mabilis, moderno, responsive sa phone.",
    "**Backend:** Python (Flask) REST API \u2014 lahat ng booking logic dito.",
    "**Database:** Supabase PostgreSQL na naka-cloud \u2014 ligtas at laging updated.",
    "**Payments:** PayMongo para sa online payment at refund.",
    "**AI:** Ask Ava chat, revenue forecast, at room recommendations.",
])

h3("Overview ng Ipapakita (read-through lang)")
bullets([
    "**User side (Person 2):** room search at filters \u2192 room details \u2192 booking (overnight o **day use**) "
    "\u2192 price breakdown \u2192 My Bookings + QR \u2192 Ask Ava AI.",
    "**Admin side (Person 3):** dashboard at analytics \u2192 bookings table \u2192 **walk-in booking** "
    "\u2192 **double-booking guard**.",
    "**Tech (Person 4):** architecture, AI, at seguridad \u2192 Q&A.",
])

gd("s", "\u201cSimulan natin sa panig ng guest \u2014 kay **[Person 2]**.\u201d")

page_break()

# ---------------------------------------------------------------- person 2
h1("Person 2 \u2014 User (Guest) Side (5\u20136 min)")
para("**Precondition:** naka-login na ang Tab 1 sa guest account (mosjaric@gmail.com).")

h2("1. Home Page")
gd("g", "Buksan ang `/` (Home). Ipakita ang hero carousel, search bar, featured rooms, at footer.")
gd("s", "\u201cIto ang landing page ng Hotel Ava \u2014 warm off-white at Royal Plum ang kulay, at agad kang "
        "makakapag-search ng room mula dito.\u201d")

h2("2. Rooms at Filters")
gd("g", "Pindutin ang **Rooms** sa header. Mag-adjust ng **dates**; i-filter ang **type / price / guests**; "
        "ipakita kung paano nagbabago ang listahan.")
gd("s", "\u201c**Real-time ang availability** dito \u2014 galing mismo sa database, kaya kung occupied ang room, "
        "hindi na ito lalabas bilang available. Hindi pwedeng mag-double book.\u201d")

h2("3. Room Details")
gd("g", "I-click ang isang room (hal. **Deluxe Room**) \u2014 gallery, amenities, **reviews**, house rules, "
        "rate per night.")
gd("s", "\u201cComplete ang details: larangan, facilities, at mga **review ng totoong guests** \u2014 bago mag-book, "
        "alam mo na ang kinukuha mo.\u201d")

h2("4. Booking Flow")
gd("g", "Pindutin **Book Now** (o Reserve). Piliin ang:")
bullets([
    "**Overnight** \u2014 check-in at check-out dates, o",
    "**Day Use** \u2014 time slots (hal. **2:00 PM, 3 oras**) \u2014 ang mga nakaraang oras ay naka-lock na, "
    "at **BOOKED** ang okupadong slots.",
])
gd("g", "Ilagay ang guests; ipakita ang **price breakdown** (rate + **12% tax** = total). "
        "Ipakita ang **Payment Option**: **Full payment** o **Downpayment (50%)** \u2014 at ang AI discount field kung may code.")
gd("s", "\u201cDalawa ang bayad: **full payment** nang walang labis, o **50% downpayment** at ang balance, "
        "babayaran na sa hotel. Seguro ang bayad \u2014 **PayMongo** ang proseso.\u201d")
note("Para sa demo, **hindi na kailangan ituloy ang payment** \u2014 sapat na ang breakdown. "
     "Kapag tinuloy, lalabas ang PayMongo sandbox page (i-cancel lang, walang totoong bayad).", color=PLUM)

h2("5. My Bookings")
gd("g", "Pindutin ang avatar → **My Bookings**. Ipakita ang status pills (**Confirmed / In-house / Completed / "
        "Cancelled**); i-open ang isang booking → **QR code**; ipakita ang **Cancel** at ang **Extend stay (+2h)**.")
gd("s", "\u201cMay **QR code** ang bawat booking \u2014 i-scan lang ito sa front desk para ma-check-in. "
        "Kung aanselahin, **24 oras bago** ang cancellation at **automatic ang refund** sa original payment. "
        "At kung gusto mong dagdagan ang stay, may **Extend** dito.\u201d")
note("Ang **admin ay walang cancel button** \u2014 guest lang ang makakansela. Iyan ay diseng pagpili: "
     "ang may-ari ng booking ang may huling salita.")

h2("6. Notifications at Profile")
gd("g", "I-click ang **bell icon** sa header; kaunting tingin sa **Profile / Settings**.")
gd("s", "\u201cMay **real-time notifications** para sa booking updates \u2014 at kumpleto ang profile "
        "management: password, avatar, details.\u201d")

h2("7. Ask Ava (AI Assistant)")
gd("g", "Buksan ang AI chat; magtanong ng halimbawa: \u201c**Ano ang pinakamurang room para sa2 pax?**\u201d "
        "o \u201c**May promo ba ngayon?**\u201d")
gd("s", "\u201cIto ang **Ask Ava** \u2014 ang AI assistant namin. Hindi siya generic chatbot: sumasagot siya "
        "batay sa **totoong data ng hotel** \u2014 mga room, presyo, at promo. Dito rin lumalabas ang "
        "**recommendation** na bahagi ng thesis namin.\u201d")

gd("s", "\u201cAdmin side naman tayo \u2014 paano i-manage ng hotel staff ang mga booking na ito. "
        "Kay **[Person 3]**.\u201d")

page_break()

# ---------------------------------------------------------------- person 3
h1("Person 3 \u2014 Admin Side (6 min)")
para("**Precondition:** naka-login ang Tab 2 sa `/admin` (admin dashboard).")

h2("1. Dashboard")
gd("g", "Ipakita ang `/admin/dashboard`: stat cards (bookings, revenue, occupancy), charts, **AI insight cards**, "
        "at ang **Scan booking** button sa tabi ng New Booking.")
gd("s", "\u201cIto ang sabay-sabay na tingin ng management \u2014 **live** ang datos, galing mismo sa database. "
        "May **AI insights** dito: forecast ng revenue at kung anong room ang pinaka-mabenta. At dito rin ang "
        "**Scan booking** para sa QR check-in.\u201d")

h2("2. Bookings Table")
gd("g", "Buksan ang **Bookings**; mag-search o mag-filter ng status; i-hover ang isang row → actions "
        "(View / **Check In** / Complete / QR).")
gd("s", "\u201cDito nakikita **lahat** ng booking \u2014 online at walk-in. May check-in at check-out control "
        "ang admin, **pero walang cancel button para sa admin** \u2014 ang cancellation ay pagpili ng guest, "
        "para may control ang mismong nag-book.\u201d")

h2("3. Walk-in Booking \u2014 Bago at AUTO IN-HOUSE \u2728")
gd("g", "Pindutin ang **New Booking** (Walk-in dialog). Sundin ang hakbang:")
steps([
    "Piliin ang **room** \u2014 may larawan at **BOOKED chips** ang mga okupadong room (at naka-lock ang mga "
    "nakaraang oras ngayon).",
    "Piliin **Overnight** o **Day Use** (time slots).",
    "Ilagay ang guests \u2014 **auto-clamp** sa maximum capacity ng room.",
    "Tingnan ang **Payment Method** \u2014 **Cash** na ang fixed na nakalagay, at ang breakdown na **pareho** "
    "ng guest side (may **12% tax**).",
    "Pindutin **Create booking**.",
])
gd("g", "Pagkatapos: ipakita ang toast **\u201cWalk-in booking created \u2014 checked in \u00b7 in-house\u201d** at "
        "ang booking sa table na **IN-HOUSE** na ang status.")
gd("s", "\u201cWalk-in guest? **Nasa counter na siya** \u2014 kaya **auto check-in** na namin siya. Walang QR na "
        "i-scan, walang hihihitayin \u2014 **in-house na kaagad**. At **cash** ang default na bayad sa counter, "
        "kasing-tulin ng manual logbook pero **naka-record na sa sistema**.\u201d")

h2("4. Double-Booking Guard \u2014 ANG WOW MOMENT \u2728")
gd("g", "Subukang i-book ang **parehong room, sa parehong araw at oras** ng bagong booking (i-click ang **BOOKED** "
        "chip o ulitin ang fill-up) \u2014 **in-expect: BLOCKED**.")
gd("s", "\u201cTingnan \u2014 **hindi pwede**. *Room is not available for the selected dates.* At hindi lang ito "
        "UI: galing ito sa **database mismo** \u2014 may **exclusion constraint** na pumipigil sa overlapping "
        "booking, kahit **sabay** pang dalawang tao ang mag-submit mula sa magkaibang device. "
        "**Double booking? Impossible.**\u201d")
note("Ito ang pinaka-strong na feature \u2014 doon itigil sandali para ma-feel ng audience. "
     "Kung may oras, ipakita rin sa **user side** (Tab 1): i-book ang parehong room \u2192 **409 conflict**.", color=PLUM)

h2("5. Iba Pang Pahina (mabilis, ~1 min)")
bullets([
    "**Rooms** \u2014 inventory, rates, at larawan ng bawat room.",
    "**Calendar** \u2014 sino ang naka-check-in ngayon at sino ang darating.",
    "**Guests** \u2014 listahan ng mga registered guest.",
    "**Reviews** \u2014 moderation: i-approve o i-reject ang review.",
    "**AI Assistant** \u2014 insights at forecast para sa management.",
    "**Settings** \u2014 configuration ng hotel.",
])

gd("s", "\u201cSa huli, ipapakita ni **[Person 4]** ang teknolohiya sa likod ng lahat ng ito.\u201d")

page_break()

# ---------------------------------------------------------------- person 4
h1("Person 4 \u2014 Tech, AI at Q&A (3\u20134 min)")

h2("Architecture (sabihin nang confident)")
bullets([
    "**React SPA** \u2192 **Flask REST API** \u2192 **Supabase PostgreSQL** \u2014 malinis na tatlong layer.",
    "**Auth:** Supabase JWT \u2014 email verification, at **OTP step-up kapag bagong device** ang login.",
    "**Payments:** PayMongo \u2014 full payment, downpayment, at **automatic refund** sa cancellation.",
    "**Data:** ~**1,300+ booking** na ang naka-process nito \u2014 may server-side pagination at exact counts.",
])

h2("Ang Mga Tanong na Tiyak na Itatanong (handa ang sagot)")
table(
    ["Tanong", "Sagot"],
    [
        ["**\u201cBakit1,305 bookings ang total pero1,104 lang sa AI stats?\u201d**",
         "Ang **All** ay kasama ang **201 cancelled**. Ang AI stats ay **active bookings lang** \u2014 para tama "
         "ang revenue forecast, occupancy, at room ranking."],
        ["**\u201cPaano niyo pinipigilan ang double booking kahit sabay ang dalawa?\u201d**",
         "Sa **database mismo**: PostgreSQL **exclusion constraint** (`bookings_no_overlap`) gamit ang time range "
         "(`booking_window()`), sakop ang **overnight at day-use**. Kahit100 sabay na request, isang lang ang "
         "pwedeng pumasok sa parehong window \u2014 race-proof."],
        ["**\u201cAno ba talaga ang AI dito?\u201d**",
         "**Ask Ava** (chat sa totoong data), **revenue/occupancy forecast**, **dynamic discounts** (15%), at "
         "**room recommendations** \u2014 lahat batay sa historical bookings, hindi canned answers."],
        ["**\u201cSekurado ba ang payments?\u201d**",
         "PayMongo ang nagpoproseso \u2014 walang card data na humihawak ang system. Refund logic awtomatiko "
         "(24h policy, 7\u201314 banking days)."],
        ["**\u201cPaano kung magulo ang datos sa dami?\u201d**",
         "Server-side pagination + exact counts (na-bypass ang **1,000-row cap** ng Supabase), at may short "
         "server cache (30\u201360s) para mabilis ang dashboard."],
    ],
    widths=[2.6, 4.4],
)

h2("Q&A Talking Points (kung walang tanong)")
bullets([
    "**Day Use support** \u2014 hindi lang overnight: may time slots, prorated pricing, at sariling booking window.",
    "**Walk-in = auto in-house** \u2014 pinagsama ang speed ng manual logbook at kaginhawaan ng sistema.",
    "**Role-based** \u2014 guest at admin, magkaiba ng poder; walang admin cancel para sa guest bookings.",
    "**Responsive** \u2014 gumagana sa phone (mobile nav, sheet menu).",
])

gd("s", "\u201cMaraming salamat po! Bukas po kami sa inyong mga tanong.\u201d \u2192 **open ang Q&A**. "
        "Kung hindi masagot agad: \u201cMahalagang tanong po iyan \u2014 ipapakita/nire-research namin, "
        "sasagutin po namin pagkatapos.\u201d")

page_break()

# ---------------------------------------------------------------- troubleshooting
h1("Troubleshooting Habang Naka-Demo")
table(
    ["Nangyari", "Gawin agad"],
    [
        ["**Puti / error ang page**", "Tingnan kung buhay ang `npm run dev` → **hard refresh** (Ctrl+Shift+R)."],
        ["**Na-logout sa gitna**", "Token expires ~1 oras \u2014 mag-login nang **bago** ang demo. Kung na-lock, "
                                   "gamitin ang fallback admin account."],
        ["**OTP prompt sa guest login**", "New device verification \u2014 **huwag** mag-login live; gamitin ang "
                                          "pre-logged na Tab 1."],
        ["**Hindi agad nagbabago ang stats**", "May **30\u201360s server cache** \u2014 normal. Hintayin lang o "
                                               "galawin ang filter."],
        ["**\u201cRoom not available\u201d sa walk-in test**", "May totoong booking doon \u2014 pumili ng ibang "
                                                              "room o petsa."],
        ["**\u201cRoom is not available\u201d sa conflict demo**", "**YAN ANG DEMO \u2014 inaasahan iyan!** "
                                                                   "Ipaliwanag na galing sa DB ang block. "],
        ["**Lumabas ang PayMongo page**", "I-cancel \u2192 balik sa My Bookings. **Walang totoong bayad** sa demo."],
        ["**May ginawang demo booking pagkatapos**", "I-record ang room/petsa \u2014 ipa-delete/ cancelled pagkatapos "
                                                     "ng demo (probe cleanup)."],
    ],
    widths=[2.4, 4.6],
)

h2("10-Second Refresher Bago ang Demo (basahin nang malakas)")
steps([
    "**Person 1:** problema \u2192 solusyon \u2192 stack \u2192 bridge kay Person 2.",
    "**Person 2:** Home \u2192 Rooms \u2192 Detail \u2192 **Booking breakdown** (huwag magbayad!) \u2192 "
    "My Bookings + QR \u2192 **Ask Ava**.",
    "**Person 3:** Dashboard \u2192 Bookings \u2192 **Walk-in (cash + AUTO IN-HOUSE)** \u2192 "
    "**CONFLICT = BLOCKED** \u2192 ibang pahina.",
    "**Person 4:** architecture \u2192 AI \u2192 **1,305 vs 1,104 at double-booking sagot** \u2192 Q&A.",
])

doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = CENTER
r = p.add_run("Good luck sa demo niyo \u2014 kayang-kaya! ")
r.italic = True; r.font.size = Pt(13); r.font.color.rgb = PLUM

doc.save(str(OUT))
print(f"Saved: {OUT}")
