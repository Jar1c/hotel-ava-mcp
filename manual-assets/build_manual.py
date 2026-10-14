# -*- coding: utf-8 -*-
"""Builds the Hotel Ava User Manual (English, expanded) from manual-assets screenshots.

Figure files follow the f<NN>-<name>.png naming; NN matches the figure number.
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
OUT = ASSETS.parent / "Hotel Ava - User Manual.docx"

doc = Document()

normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(11)
for hname, sz in [("Title", 40), ("Heading 1", 18), ("Heading 2", 14), ("Heading 3", 12)]:
    st = doc.styles[hname]
    st.font.name = "Calibri"
    st.font.size = Pt(sz)
    st.font.color.rgb = PLUM

FIG = [0]


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


def para(text, size=None, space_after=6, align=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
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


def figure(fname, caption):
    FIG[0] += 1
    p = doc.add_paragraph()
    p.alignment = CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(str(ASSETS / fname), width=Inches(6.1))
    c = doc.add_paragraph()
    c.alignment = CENTER
    c.paragraph_format.space_after = Pt(12)
    rich(c, f"Figure {FIG[0]}. {caption}", size=9, italic=True, color=GRAY)


def h1(t):
    doc.add_heading(t, level=1)


def h2(t):
    doc.add_heading(t, level=2)


def page_break():
    doc.add_page_break()


# ---------------------------------------------------------------- title page
for _ in range(6):
    doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = CENTER
r = p.add_run("HOTEL AVA")
r.bold = True
r.font.size = Pt(46)
r.font.color.rgb = PLUM

p = doc.add_paragraph()
p.alignment = CENTER
r = p.add_run("USER MANUAL")
r.bold = True
r.font.size = Pt(26)
r.font.color.rgb = TEAL

p = doc.add_paragraph()
p.alignment = CENTER
r = p.add_run("Smart Hotel Reservation and Recommendation System")
r.italic = True
r.font.size = Pt(14)
r.font.color.rgb = GRAY

doc.add_paragraph()
doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = CENTER
r = p.add_run("A Usage Guide for Guests and Administrators")
r.font.size = Pt(13)

p = doc.add_paragraph()
p.alignment = CENTER
r = p.add_run("Hotel Ava Malate, Manila  |  October 2026")
r.font.size = Pt(11)
r.font.color.rgb = GRAY

page_break()

# ---------------------------------------------------------------- contents
h1("Contents")
bullets([
    "1.  Introduction",
    "2.  System Flow",
    "3.  How to Access the System",
    "4.  Guest (User) Manual",
    "      4.1 Home Page  |  4.2 Rooms & Suites  |  4.3 Room Details  |  4.4 Creating an Account",
    "      4.5 Email Verification  |  4.6 Sign In  |  4.7 New-Device Verification  |  4.8 Quick Sign-In (QR)",
    "      4.9 Forgot & Reset Password  |  4.10 Making a Booking  |  4.11 My Bookings  |  4.12 My Reviews",
    "      4.13 Profile  |  4.14 Changing Your Avatar  |  4.15 Account Menu  |  4.16 Settings",
    "      4.17 Ask Ava (AI Chat)  |  4.18 Help Center",
    "5.  Admin Manual",
    "      5.1 Admin Portal  |  5.2 Dashboard  |  5.3 Bookings  |  5.4 Rooms  |  5.5 Guests",
    "      5.6 Calendar  |  5.7 Reviews  |  5.8 AI Assistant  |  5.9 Settings",
    "6.  FAQ / Troubleshooting",
    "7.  Demo Accounts",
], indent=0.2)

page_break()

# ---------------------------------------------------------------- 1. intro
h1("1.  Introduction")
para(
    "**Hotel Ava** is a **Smart Hotel Reservation and Recommendation System** for Hotel Ava "
    "Malate \u2014 a drive-in hotel located at Madre Ignacia St. cor. Quirino Ave., Malate, "
    "Manila. The system makes it easy to search for rooms, book online, pay, and manage the "
    "hotel using **AI-powered features**."
)
para("There are two types of users of the system:")
bullets([
    "**Guest** \u2014 customers who search for rooms, book online, and leave reviews.",
    "**Admin** \u2014 hotel staff/management who handle bookings, rooms, guests, calendar, "
    "reviews, and analytics through a separate Admin Portal.",
])
para("Key features:")
bullets([
    "**Room search and recommendation** \u2014 filters (room type, price, rating, promos) and AI recommendations.",
    "**AI Boost pricing** \u2014 discounts derived from AI demand forecasting, shown in the price breakdown.",
    "**Online booking and payment** \u2014 via PayMongo (cards, e-wallets; in test mode for the demo).",
    "**Reviews and ratings** \u2014 written by guests and visible per room by admins.",
    "**Admin analytics** \u2014 demand and revenue forecasts, discount ideas, and hotel statistics.",
    "**Account security** \u2014 one-time codes (OTP) on new devices, Google sign-in, QR Quick Sign-In, device management, password changes, and scheduled account deletion.",
    "**Ask Ava AI assistant** \u2014 a floating chat assistant on every page plus a full Help Center.",
])

# ---------------------------------------------------------------- 2. flow
h1("2.  System Flow")
para("**Guest flow (complete customer journey):**")
steps([
    "Home Page \u2192 fill in the search bar (Stay Dates, Guests, Budget) \u2192 CHECK AVAILABILITY",
    "Rooms & Suites \u2192 apply filters and click the room you want",
    "Room Details \u2192 review the price, AI Boost discount, and amenities \u2192 click Reserve",
    "Sign In / Register (if not logged in yet) \u2192 verify your email with the one-time code \u2192 on a new device, verify it's you with the OTP",
    "Booking page \u2192 confirm the dates, guests, and total \u2192 Proceed to Payment",
    "PayMongo checkout \u2192 when successful, the **Booking Confirmation** page appears",
    "My Bookings \u2192 track the status; after the stay \u2192 My Reviews to leave a rating",
])
para("**Admin flow (for hotel staff):**")
steps([
    "Visit the Admin Portal (/admin) \u2192 Sign In with an admin account",
    "Dashboard \u2192 Operations (arrivals, downpayment, in-house), Needs Attention (refunds), Performance (revenue, occupancy, AI insights)",
    "Switch to Bookings / Rooms / Guests / Calendar / Reviews using the sidebar",
    "AI Assistant \u2192 Smart Forecast, Discounts, and Hotel Stats for data-driven decisions",
])

# ---------------------------------------------------------------- 3. access
h1("3.  How to Access the System")
bullets([
    "**Browser** \u2014 use an up-to-date Chrome, Brave, Edge, or Firefox.",
    "**URL** \u2014 in development: `http://localhost:5173` (frontend), connected to the backend at `http://localhost:5000`.",
    "**Internet connection** \u2014 the database (Supabase) and payment gateway (PayMongo) are cloud-hosted, so an internet connection is required.",
    "**Device** \u2014 runs on desktop and mobile browsers (fully responsive pages).",
])

page_break()

# ---------------------------------------------------------------- 4. guest
h1("4.  Guest (User) Manual")

h2("4.1  Home Page")
para(
    "This is the first page you see when opening the system. The **header** shows the logo and "
    "Hotel Ava on the left, Home, Rooms & Suites, About, and Contact Us in the middle, and the "
    "Sign In button on the right (plus the account menu once you are logged in). Below the "
    "\"Dare To Be Different here\" hero banner is the **search bar**, followed by the Featured "
    "Rooms section. The floating **Ask Ava** assistant button sits at the bottom-right corner "
    "(see 4.17)."
)
figure("f01-home.png", "Home Page \u2014 hero, search bar, and featured rooms")
para("**How to search for a room from the Home Page:**")
steps([
    "Select the stay type: **Overnight Stay** or **Day Use** (the tabs above the search bar)",
    "Click **Stay Dates** and choose the check-in and check-out dates",
    "Under **Guests**, select the number of adults (and children, if applicable)",
    "Adjust the **Budget** slider (\u20b10 \u2013 \u20b15,000) or set it to \"Any\" for no limit",
    "Click the **CHECK AVAILABILITY** button \u2014 you will be taken to the Rooms & Suites page, "
    "pre-filtered with your selections",
])

h2("4.2  Rooms & Suites")
para(
    "This page lists all **13 rooms** of Hotel Ava. The **Filters** panel on the left lets you "
    "narrow down by Room type (Deluxe, Executive Deluxe, Junior Suite, Standard, Superior "
    "Suite), Price per night slider, Guest rating (Any, 4.0 & up, 4.5 & up), and Promotions "
    "(rooms with an active promo). Each room card shows the photo, guest rating, capacity, room "
    "name, amenities (Air Conditioning, Free WiFi, Cable TV, Parking, Hot & Cold Shower), the "
    "nightly rate, and the **day use rates** (3h, 6h, 8h, 12h)."
)
figure("f02-rooms.png", "Rooms & Suites \u2014 filters and room cards")
para("Steps:")
steps([
    "Use the **checkboxes and sliders** in the Filters panel to narrow by type, price, and rating",
    "Check the result count at the top (\"13 rooms available\")",
    "Click a **room card** to open its details",
    "If a room has a promo, its badge is shown on the card",
])

h2("4.3  Room Details and Pricing")
para(
    "The Room Details page shows the full information of the selected room: the **stay type "
    "selector** (Overnight Stay / Day Use), check-in date, time slots, and number of guests. On "
    "the right is the **Price breakdown**: room rate, the **AI Boost discount** (e.g., 15% off "
    "\u2014 a discount derived from the system's AI demand forecasting), taxes and fees, and the "
    "**Total**. An \"About this room\" section covers the description, amenities, and the room "
    "policies."
)
figure("f03-room-detail.png", "Room Details \u2014 stay setup and price breakdown")
para("Steps:")
steps([
    "Select **Overnight Stay** or **Day Use** at the top of the form",
    "Set the **date, time, and number of guests**",
    "Review the **Price breakdown** \u2014 the discount, taxes, and total are calculated automatically",
    "Click the **Reserve / Book** button \u2014 if you are not logged in yet, you will be taken to the Sign In page first",
])

h2("4.4  Creating an Account (Register)")
para(
    "The Register page offers two options: the quick **Continue with Google** button, or "
    "manually filling out the form (First Name, Last Name, Email, and a Password with a minimum "
    "of 8 characters). The **Terms of Privacy** checkbox must be ticked before the Create "
    "Account button becomes active."
)
figure("f04-register.png", "Register page \u2014 creating a new account")
para("Steps:")
steps([
    "On the Sign In page, click the **Create one / Sign Up** link",
    "Choose **Continue with Google** or fill out the form manually",
    "Create a password with **8 or more characters**",
    "Tick **\"I agree to the Terms and Privacy Policy\"**",
    "Click **Create Account** \u2014 then verify your email (see 4.5)",
])

h2("4.5  Email Verification")
para(
    "After registering, the system sends a **one-time code** to your email address to prove "
    "that it is really yours. Open the **Verify Email** page and enter the 8-digit code. If you "
    "prefer copying, the **Paste the Code** page accepts the whole code in a single field. Once "
    "verified, you can sign in."
)
figure("f05-verify-email.png", "Verify Email \u2014 enter the one-time code sent to your email")
figure("f06-copy-code.png", "Paste the Code page \u2014 an easier way to enter the code from your email")
para("Steps:")
steps([
    "Open your inbox and find the verification email from Hotel Ava",
    "On the **Verify Email** page, type the **8-digit code**",
    "Or click the **Copy Code** page and paste the code in one field",
    "Submit \u2014 after verification you are redirected so you can sign in",
    "No email yet? Check the **Spam/Junk** folder, or request a new code",
])

h2("4.6  Sign In")
para(
    "There are three ways to sign in: (1) **Continue with Google**, (2) **Quick Sign-In** with "
    "a QR code from another device (see 4.8), and (3) **Email + Password**. The \"Forgot "
    "password?\" link below the form resets your password (see 4.9)."
)
figure("f07-login.png", "Sign In page \u2014 Google, Quick Sign-In, and password")
para("Steps:")
steps([
    "Go to the **Sign In** page (or click the Sign In button in the header)",
    "Enter your **email and password** \u2014 or click **Continue with Google**",
    "Click the **Sign In** button",
    "If it is your first time on that device, complete the verification in 4.7 first",
])

h2("4.7  Sign-In Verification on a New Device")
para(
    "For your account's protection, signing in from a **new device or browser** triggers the "
    "\"**Verify it's you**\" dialog. The system emails you an **8-digit one-time code (OTP)** "
    "\u2014 enter it and click **Verify and continue**. A countdown shows when you can click "
    "**Resend code**. After the device is verified, it is **remembered** \u2014 your next "
    "sign-ins from the same device will not ask for the code again."
)
figure("f08-otp-challenge.png", "Verify it's you \u2014 one-time code requested on a new device")
para("Steps:")
steps([
    "Sign in with your email and password as usual",
    "When the **Verify it's you** dialog appears, open your inbox",
    "Enter the **8-digit code** and click **Verify and continue**",
    "Nothing arrived? Click **Resend code** after the countdown, or check Spam/Junk",
    "You can also click **Back to sign in** to cancel and try again later",
])

h2("4.8  Quick Sign-In with QR")
para(
    "Quick Sign-In lets you sign in to a **new device without typing a password** \u2014 you "
    "approve it from a device where you are already logged in. The request expires after about "
    "**5 minutes**."
)
figure("f09-qr-challenge.png", "Quick Sign-In \u2014 QR code and device code shown on the new device's login page")
para("**On the new device (the one signing in):**")
steps([
    "Open the Sign In page and click **Sign in with Quick Sign-In**",
    "A **QR code** and a **device code** (e.g., YS7R H3G8) appear, with the status "
    "\"Waiting for approval\" and the expiry countdown",
])
figure("f10-settings-quick-signin.png", "Settings \u203a Quick Sign-In \u2014 approve the other device from your signed-in account")
para("**On your already signed-in device (approving):**")
steps([
    "Go to **Settings \u203a Quick Sign-In**",
    "Type the **device code** shown on the other device and click **Sign in device** \u2014 or "
    "click **Scan QR** and point the camera at the QR code",
    "The new device is signed in instantly \u2014 no password or OTP needed",
])

h2("4.9  Forgot and Reset Password")
para(
    "If you no longer remember your password, the system can send a **password reset link** to "
    "your email."
)
figure("f11-forgot-password.png", "Forgot Password \u2014 enter your email to receive a reset link")
figure("f12-reset-password.png", "Reset Password \u2014 set and confirm your new password")
para("Steps:")
steps([
    "On the Sign In page, click **Forgot password?**",
    "Enter your **email address** and click **Send reset link**",
    "Open the reset email from Hotel Ava and **click the link** (check Spam/Junk if needed)",
    "On the Reset Password page, type a **new password** twice (new + confirm)",
    "Save \u2014 then sign in with your new password",
])

h2("4.10  Making a Booking")
para(
    "From Room Details, fill out the booking form: confirm the **stay dates and times**, number "
    "of guests, and any special requests. The full **price breakdown** is shown before payment. "
    "Payment is made via **PayMongo** (cards, e-wallets, and more \u2014 in test mode for the "
    "demo system)."
)
figure("f13-booking.png", "Booking page \u2014 stay confirmation and payment")
para("Steps:")
steps([
    "From Room Details, click **Reserve / Book Now**",
    "Confirm the **dates, times, guests, and total amount due**",
    "Click the **Proceed to Payment / Pay** button",
    "Complete the **PayMongo checkout** (for the demo: use the test card provided by PayMongo)",
    "When the payment succeeds, the **Booking Confirmation** page appears with your booking reference",
    "If the payment fails, a **Payment Failed** page appears with an option to try again",
    "You will receive a **confirmation email**, and the booking will appear under **My Bookings**",
])
para(
    "After a successful payment, the system emails you a **Booking confirmation email** with "
    "your booking reference, stay details, amount paid, and balance due. The same Hotel Ava "
    "design is used for the other booking emails (cancellation, expiry, failed payment, and "
    "refund notices)."
)
figure("f41-booking-email.png", "Booking confirmation email \u2014 the real Hotel Ava email sent after payment")

h2("4.11  My Bookings")
para(
    "This page lists all of your reservations with their status \u2014 **Pending, Confirmed, "
    "In-house, Completed, Cancelled, or Refunded** \u2014 along with the details and booking "
    "reference of each one. If you have no bookings yet, an empty state saying \"No bookings "
    "yet\" appears with a **Browse Rooms** button. You can also open the review form for a stay "
    "from here once it is finished."
)
figure("f14-my-bookings.png", "My Bookings \u2014 list of reservations (empty state when there are no bookings yet)")
para("Steps:")
steps([
    "Open the **account menu** in the header \u2192 **My Bookings**",
    "Use the **status tabs / filters** to narrow down to the booking you need",
    "Click a booking to see its details, reference, and status",
    "After a stay is finished, you can leave a **review** from this page",
])

h2("4.12  My Reviews")
para(
    "My Reviews shows the reviews you have written \u2014 including the **star rating** and "
    "comment you gave for each room. If you have not written any yet, an empty state reminds "
    "you that reviews can be left from **My Bookings** after a stay. Your reviews help other "
    "guests choose a room, and admins can see them under \"Ratings by room\"."
)
figure("f15-my-reviews.png", "My Reviews \u2014 the reviews you have written")
para("Steps:")
steps([
    "Open the **account menu \u2192 My Reviews**",
    "If you have a finished booking, click **Rate** / Leave a review",
    "Give the room **1\u20135 stars** and write your comment",
    "Submit \u2014 it appears immediately in My Reviews and in the room's public ratings",
])

h2("4.13  Profile")
para(
    "The Profile page shows your **Personal Information**. Click **Edit** to switch to edit "
    "mode, where you can change your **name** (Save / Cancel appear at the top right; the name "
    "can be changed **once every 30 days** for security). Your **email address cannot be "
    "changed** \u2014 it is locked for the integrity of bookings and account security."
)
figure("f16-profile.png", "Profile page \u2014 personal information")
figure("f17-profile-edit.png", "Profile edit mode \u2014 change your name (email stays locked)")
para("Steps:")
steps([
    "Open the **account menu \u2192 Profile**",
    "Click **Edit** (top right of the Personal Information card)",
    "Change your **First Name / Last Name**, then click **Save** \u2014 or **Cancel** to discard",
    "Review your email address (cannot be changed \u2014 all bookings and security codes are tied to it)",
])

h2("4.14  Changing Your Avatar")
para(
    "Your profile picture can be changed while in **edit mode** on the Profile page. Click your "
    "avatar to open the **Profile Picture** menu with three options: **Choose Avatar** (pick a "
    "preset illustrated avatar), **Upload Photo** (use your own image), and **Remove Photo** "
    "(go back to the automatically generated avatar). New accounts get a generated avatar based "
    "on their name/email."
)
figure("f18-avatar-picker.png", "Profile Picture menu \u2014 Choose Avatar, Upload Photo, and Remove Photo")
para("Steps:")
steps([
    "Go to **Profile** and click **Edit**",
    "Click your **avatar** \u2014 the Profile Picture menu opens",
    "Pick **Choose Avatar** for a preset, **Upload Photo** for your own picture, or **Remove Photo** to reset",
    "Finish with **Save** to apply your changes",
])

h2("4.15  Account Menu")
para(
    "Clicking your **name/avatar in the header** opens the account menu \u2014 your shortcut to "
    "everything personal: **Profile**, **My Bookings**, **My Reviews**, **Settings**, **Help "
    "Center**, and **Sign Out**. (Admins also see the **Admin** link here.)"
)
figure("f19-header-menu.png", "Account menu in the header \u2014 quick links to your pages")

h2("4.16  Settings")
para(
    "Settings has four tabs: **Appearance**, **Login & security**, **Devices**, and **Quick "
    "Sign-In**."
)
figure("f20-settings-appearance.png", "Settings \u203a Appearance \u2014 theme modes and color schemes")
para(
    "**Appearance** \u2014 choose **Light**, **Dark**, or **System** theme and one of six color "
    "schemes: **Royal Plum** (default), **Ocean Blue**, **Forest Green**, **Sunset Orange**, "
    "**Rose Gold**, and **Midnight**. Changes apply immediately and are remembered for your "
    "account."
)
para(
    "**Login & security** \u2014 two cards: **Connected accounts** (your Email is marked "
    "\"Connected\"; click **Connect Google** to link Google sign-in) and **Change Password** "
    "(enter your Current Password, New Password, and Confirm New Password, then click **Update "
    "Password**)."
)
figure("f21-settings-security.png", "Settings \u203a Login & security \u2014 connected accounts and Change Password")
para(
    "**Danger zone / Delete account** \u2014 at the bottom of Login & security. Deleting your "
    "account is **permanent after a 30-day grace period**, and you can **cancel any time** "
    "before then."
)
figure("f22-settings-danger-zone.png", "Danger zone \u2014 Delete account with a 30-day grace period")
para(
    "**Devices** \u2014 the **Devices & activity** list shows every device signed in to your "
    "account (browser and OS, last active time, and the date it was added). The current device "
    "carries a **THIS DEVICE** badge. Review this list regularly and sign out anything you do "
    "not recognize."
)
figure("f23-settings-devices.png", "Settings \u203a Devices \u2014 devices & activity")
para("**Steps (change password):**")
steps([
    "Open **Settings \u203a Login & security**",
    "Under Change Password, enter your **current password**, then the **new password** twice",
    "Click **Update Password** \u2014 use the new password the next time you sign in",
])
para("**Steps (review devices):**")
steps([
    "Open **Settings \u203a Devices**",
    "Check each device's **last active** time and location",
    "Sign out any session you do not recognize (its owner must verify again to get back in)",
])

h2("4.17  Ask Ava \u2014 AI Chat Assistant")
para(
    "The floating **Ask Ava** button at the bottom-right corner of every page opens the chat "
    "assistant. The panel header shows the assistant's status (**Hotel Ava Assistant \u00b7 "
    "Online**). Ask it about **bookings, payments, cancellations, check-in/out, day use, "
    "accounts, and promotions** \u2014 it replies instantly. For very specific questions (for "
    "example, exact room amenities), it will point you to the front desk, and a **Browse full "
    "Help Center** link is always at the bottom of the panel."
)
figure("f24-chatbot.png", "Ask Ava \u2014 the floating AI assistant answering a guest's question")
para("Steps:")
steps([
    "Click the **Ask Ava** button (bottom-right) on any page",
    "Type your question and press **Enter** / the send button",
    "Read the reply \u2014 ask follow-up questions in the same panel",
    "Click **Browse full Help Center** for the FAQ and more help options",
])

h2("4.18  Help Center")
para(
    "The Help Center is the place for questions. It has a **search bar** and FAQ categories "
    "(bookings, payments, account, etc.) with ready answers, plus an **AI assistant** that "
    "answers follow-up questions (powered by Gemini / OpenRouter). If your question is still "
    "unanswered, the hotel's front desk contact information is also listed here."
)
figure("f25-help.png", "Help Center \u2014 FAQ and AI assistant")
para("Steps:")
steps([
    "Click the **Help** link in the account menu (or the Ask Ava button on any page)",
    "Type your question in the **search bar** or pick an FAQ category",
    "Use the **AI assistant** for more specific questions \u2014 include your booking reference if you are asking about a specific booking",
    "If there is still no answer, contact the front desk using the listed contact details",
])

page_break()

# ---------------------------------------------------------------- 5. admin
h1("5.  Admin Manual")

h2("5.1  Admin Portal (Login)")
para(
    "The **/admin** portal is separate and intended for hotel staff. The left half shows the "
    "hero image and \"Dare To Be Different Here at Hotel Ava\"; the right half contains the "
    "login form: Email, Password, and the **Sign In to Admin** button. A \"Back to Hotel Ava\" "
    "link returns to the guest site. Note: this portal is **for admin accounts only** \u2014 a "
    "regular guest account will be rejected (\"Access denied\")."
)
figure("f26-admin-login.png", "Admin Portal \u2014 login page for hotel staff")
para("Steps:")
steps([
    "Go to **/admin** in the browser (or the Admin link in the Account dropdown if you are an admin)",
    "Enter the **admin email and password**",
    "Click **Sign In to Admin**",
    "You are taken to the **Admin Dashboard**, where all sections in the sidebar become available",
])

h2("5.2  Dashboard")
para(
    "This is the operations hub. The **sidebar** is on the left (Dashboard, Bookings, Rooms, "
    "Guests, Calendar, Reviews, AI Assistant, Other, Settings, and Log Out), with the **global "
    "search bar** at the top. The dashboard has three main parts:"
)
bullets([
    "**Operations** \u2014 Arrivals today (guests due to check in today, with a direct **Check-in** button and a Late badge when applicable), **Downpayment** (total outstanding balance), and **In-house** (currently checked in).",
    "**Needs attention** \u2014 items that require action, such as **Refunds to process** (with booking count and amount).",
    "**Performance** \u2014 **Monthly revenue** (paid bookings by stay date, with a comparison to the same days last month), **Occupancy rate**, and the **AI Insights** card, which suggests discount ideas with a direct link to the AI Assistant.",
])
figure("f27-admin-dashboard.png", "Admin Dashboard \u2014 Operations, Needs Attention, and Performance")
para("**Notifications** \u2014 the **bell icon** at the top right opens the notifications "
     "dropdown with the latest alerts and a **View all notifications** link.")
figure("f28-admin-notifications.png", "Notifications \u2014 bell dropdown with recent alerts")
para("**Scan booking** \u2014 the button next to the Dashboard title opens the **Verify guest "
     "QR code** dialog. You can point the **camera** at the guest's QR code, **upload a QR "
     "image**, or **paste the QR link / booking code** (e.g., #6D8ED17E) and click **Verify** "
     "\u2014 handy at the front desk for arriving guests.")
figure("f29-admin-scan-booking.png", "Verify guest QR code \u2014 camera, upload, or code entry")
para("Steps:")
steps([
    "Use the **sidebar** to move between sections",
    "In **Arrivals today**, click the **Check-in** button to process a guest's arrival",
    "Click the **notification bell** to see new alerts",
    "Click **Scan booking** and verify a guest's QR code when they arrive",
    "In the **AI Insights** card, click **Review** to see the suggested discounts",
])

h2("5.3  Bookings")
para(
    "This is where **all bookings** are managed. At the top are the **status tabs** with "
    "counts: All, Pending, Confirmed, In-house, Completed, Checked Out, Cancelled, Refunds, and "
    "Refunded. There is a **search** (name, email, booking ID, room), a **room filter**, and "
    "**sort** options. Each row shows the Guest, Stay Date, Room, Type, Amount (with a \"50 "
    "paid\" marker when partially paid), and Status. The **Verify QR** button is at the top "
    "right."
)
figure("f30-admin-bookings.png", "Admin Bookings \u2014 list, status tabs, and actions")
para(
    "Clicking a booking opens the **Booking Details** dialog: the room's photo and name, "
    "**Booking ID**, **Booked On** date, **Stay** dates, **Room**, **Guests**, **Length**, "
    "**Arrival** and **Checkout** times, and the **Payment** card (Method such as GCash, "
    "Amount, and Status) with a **View Receipt** button."
)
figure("f31-admin-booking-detail.png", "Booking Details \u2014 room, stay, and payment information")
para("Steps:")
steps([
    "Pick a **status tab** (e.g., Pending) to show only those bookings",
    "Use the **search** to find a booking by name, email, or booking ID",
    "Click a booking to open its **Booking Details** and process actions (e.g., review a refund, view the receipt)",
    "Use **Verify QR** when a guest presents their booking QR code at the front desk",
])

h2("5.4  Rooms")
para(
    "The hotel's **room inventory** \u2014 rooms, prices, capacity, and status. Tabs are "
    "available for **All, Available, Occupied, and Maintenance**, along with search, a type "
    "filter, and sort. Each row shows the photo, Room ID, name, type badge, **price**, "
    "**capacity** (adults, children, pet friendly), **status**, number of **bookings**, "
    "**revenue**, and actions (edit / delete). The **+ Add Room** button at the top adds a new "
    "room."
)
figure("f32-admin-rooms.png", "Admin Rooms \u2014 inventory, pricing, and revenue per room")
para(
    "The **Add New Room** dialog collects everything a room needs: **Room Details** (Room Name, "
    "Type, Price per night, optional **Day Use Pricing** for 3h / 6h / 8h / 12h \u2014 leave "
    "blank to auto-price from the nightly rate, Max Adults / Children / Pets where 0 means not "
    "allowed, auto-computed Total Capacity, Status, and the About description) and **Room "
    "Images** (up to 5). The same dialog is used when editing via the pencil icon."
)
figure("f33-admin-add-room.png", "Add New Room \u2014 room details, day-use pricing, and images")
para("Steps:")
steps([
    "Click **+ Add Room** to add a new room (name, type, price, capacity, images)",
    "Use the **pencil (edit)** icon in a row to change a room's price or details",
    "Use the **trash (delete)** icon to remove a room (be careful \u2014 a confirmation will appear)",
    "Filter by **status** to see which rooms are Available or Occupied",
])

h2("5.5  Guests")
para(
    "A list of **guest profiles and stay history**. Each row shows the avatar and name, email, "
    "number of **bookings**, **total spent**, and **last stay**. Search and sort options (e.g., "
    "**Top spenders**) make it easy to find your most valuable guests."
)
figure("f34-admin-guests.png", "Admin Guests \u2014 profiles and stay history")
para("Steps:")
steps([
    "Use the **search** to find a guest by name or email",
    "Pick a **sort order** (e.g., Top spenders) as needed",
    "Click a guest to see their booking and stay history",
])

h2("5.6  Calendar")
para(
    "A **monthly calendar view** of all bookings \u2014 you can see who is booked on each day at "
    "a glance. Entries are **color-coded** by room type according to the legend at the bottom "
    "(Standard Room, Deluxe, Executive Deluxe, Junior Suite, Suite, Superior Suite). Use the "
    "arrows to move between months; the current day is highlighted."
)
figure("f35-admin-calendar.png", "Admin Calendar \u2014 daily booking calendar")
para("Steps:")
steps([
    "Use the **< and > arrows** at the top to change months",
    "Read the **color-coded** entries to see occupancy per day",
    "Click a day or booking to see its details",
])

h2("5.7  Reviews")
para(
    "Guest **sentiment and ratings**. Three summary cards sit at the top: **Overall Rating** "
    "(e.g., 4.1 out of 5), **Total Reviews** (e.g., 669), and **Rooms With Reviews** (13/13 "
    "\u2014 every room has reviews). Two tabs are available: **Ratings by room** (average rating "
    "and review count per room) and **All reviews** (each individual review)."
)
figure("f36-admin-reviews.png", "Admin Reviews \u2014 overall rating and ratings by room")
para("Steps:")
steps([
    "Check the **Overall Rating** cards for a quick summary",
    "In **Ratings by room**, click a room to see its reviews",
    "Use the **All reviews** tab to read every guest comment",
])

h2("5.8  AI Assistant")
para(
    "The hotel's **AI analytics** hub. It has three tabs: **Smart Forecast**, **Discounts**, "
    "and **Hotel Stats**. In Smart Forecast, the **AI-Powered Insights** strip shows three "
    "cards \u2014 \"How full we'll be\" (occupancy projection for the next 30 days, with a trend "
    "label such as TRENDING DOWN), **Expected earnings** (revenue for the next 30 days, with a "
    "percentage change), and **Discount ideas** (number of active proposals). Below are two "
    "charts: **Demand Forecast** (actual vs. predicted occupancy with seasonality) and "
    "**Revenue Forecast** (actual vs. predicted monthly revenue), both with a \"Today\" marker."
)
figure("f37-admin-ai.png", "Admin AI Assistant \u2014 Smart Forecast, charts, and discount ideas")
para(
    "The **Discounts** tab has two sub-tabs: **Room Demand** and **Holiday Discounts**. When "
    "the AI detects weak bookings, a banner such as \"**5 room types need a boost**\" appears. "
    "Each room-type card shows the number of rooms, upcoming bookings, projected occupancy for "
    "the next 30 days, a **Critical** label with nights booked, the 90-day average occupancy, "
    "and the current rate \u2014 plus a suggested discount (e.g., **15% off** with the old and "
    "new price) and an **Apply Discount** button."
)
figure("f38-admin-discounts.png", "AI Discounts \u2014 room demand and suggested price cuts")
para(
    "The **Hotel Stats** tab summarizes performance: the **Seasonal Trend** chart (monthly "
    "booking volume and revenue, with peak season vs. off-peak), **Room Performance** (revenue "
    "by room type for the current month, with occupancy, nightly average, and total), and "
    "summary cards: **Total Bookings**, **Best Room**, **Total Revenue**, and **Peak Months**."
)
figure("f39-admin-hotel-stats.png", "AI Hotel Stats \u2014 seasonal trends and room performance")
para("Steps:")
steps([
    "The **Smart Forecast** tab opens by default \u2014 read the insight cards at the top",
    "Scroll down for the **Demand Forecast** and **Revenue Forecast** charts (solid = actual, dashed = predicted)",
    "Open the **Discounts** tab to review AI-generated discount ideas and click **Apply Discount** on the ones you want",
    "Open the **Hotel Stats** tab for seasonal trends and per-room-type performance",
])

h2("5.9  Admin Settings")
para(
    "The admin account's profile and security. It shows the **avatar and name** (e.g., \"Ava "
    "Admin\") with the subtitle \"Hotel Ava Administrator\" and an **Edit** button, plus the "
    "**Profile** and **Security** tabs. Personal Information includes the email address, phone, "
    "**Role** (Administrator badge), **Joined** date, and **Location**."
)
figure("f40-admin-settings.png", "Admin Settings \u2014 admin account profile and security")
para("Steps:")
steps([
    "Click **Edit** to change the admin's name or phone number",
    "Use the **Security** tab for password and security settings",
    "To sign out, click **Log Out** at the bottom of the sidebar",
])

page_break()

# ---------------------------------------------------------------- 6. FAQ
h1("6.  FAQ / Troubleshooting")
bullets([
    "**\"Access denied. This portal is for admins only.\"** \u2014 a guest account was used in the Admin Portal (/admin). That portal is for admin accounts only; go back to the normal Sign In page if you are a guest.",
    "**What is the \"Verify it's you\" code?** \u2014 a one-time code (OTP) sent to your email when signing in from a new device (see 4.7). Once verified, that device is remembered.",
    "**How do I sign in on another device without a password?** \u2014 use Quick Sign-In: open the QR/code screen on the new device's login page, then approve it from Settings \u203a Quick Sign-In of your signed-in device (see 4.8).",
    "**How do I change my password?** \u2014 Settings \u203a Login & security \u203a Change Password: enter the current and new password, then Update Password (see 4.16).",
    "**I forgot my password** \u2014 use \"Forgot password?\" on the Sign In page; the system will email you a reset link (see 4.9).",
    "**How do I change my avatar / profile picture?** \u2014 Profile \u203a Edit \u203a click your avatar, then Choose Avatar, Upload Photo, or Remove Photo (see 4.14).",
    "**Can I change my email?** \u2014 no; the email on your Profile is locked for security and booking integrity.",
    "**How do I see the devices signed in to my account?** \u2014 Settings \u203a Devices (see 4.16). Sign out anything you do not recognize.",
    "**How do I delete my account?** \u2014 Settings \u203a Login & security \u203a Danger zone \u203a Delete account. It is permanent after a 30-day grace period, which you can cancel any time.",
    "**Why is my booking not showing in My Bookings?** \u2014 the payment may not have completed. Check your confirmation email, or try again from Room Details.",
    "**The payment failed** \u2014 the Payment Failed page will appear and you can try again. For the demo, make sure you are using PayMongo's test card.",
    "**What is \"AI Boost\" in the price?** \u2014 a discount given by the AI based on demand forecasting; it appears in the Price breakdown on the Room Details and Booking pages.",
    "**What is Ask Ava?** \u2014 the floating AI chat assistant on every page (see 4.17). For room-specific questions it will direct you to the front desk.",
    "**I am not receiving any email (verification, OTP, or booking confirmation)** \u2014 check your Spam/Junk folder and make sure the email address is correct.",
])

# ---------------------------------------------------------------- 7. demo
h1("7.  Demo Accounts")
para("The accounts below were used to produce this manual and can be used to demonstrate the system:")
table = doc.add_table(rows=3, cols=4)
table.style = "Table Grid"
rows = [
    ("Account", "Email", "Password", "Role"),
    ("Demo Guest", "manual.guest@hotelava-demo.com", "HotelAvaManual2026", "Guest"),
    ("Demo Admin", "manual.admin@hotelava-demo.com", "HotelAvaManual2026", "Admin"),
]
for ri, row in enumerate(rows):
    for ci, val in enumerate(row):
        cell = table.cell(ri, ci)
        cell.text = ""
        cp = cell.paragraphs[0]
        r = cp.add_run(val)
        r.font.size = Pt(10)
        if ri == 0:
            r.bold = True
            r.font.color.rgb = PLUM

doc.add_paragraph()
para(
    "**Note:** These accounts were created exclusively for demonstrating this manual. Replace "
    "or remove them before final submission, and never expose the passwords in a production "
    "deployment.",
    size=10,
)
para(
    "This manual was produced from the actively running system (October 2026) \u2014 all images "
    "are real screenshots of the system using demo/seed data.",
    size=10,
)

# footer with page number
footer_p = doc.sections[0].footer.paragraphs[0]
footer_p.alignment = CENTER
r = footer_p.add_run("Hotel Ava \u2014 User Manual  |  Page ")
r.font.size = Pt(9)
r.font.color.rgb = GRAY
run = footer_p.add_run()
f1 = OxmlElement("w:fldChar")
f1.set(qn("w:fldCharType"), "begin")
it = OxmlElement("w:instrText")
it.set(qn("xml:space"), "preserve")
it.text = "PAGE"
f2 = OxmlElement("w:fldChar")
f2.set(qn("w:fldCharType"), "end")
run._r.append(f1)
run._r.append(it)
run._r.append(f2)
run.font.size = Pt(9)
run.font.color.rgb = GRAY

doc.save(str(OUT))
print(f"DONE: {OUT}")
print(f"FIGURES: {FIG[0]}")
