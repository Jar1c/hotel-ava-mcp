export interface FaqItem {
  id: string
  category: string
  q: string
  keywords: string[]
  a: string
}

export const FAQ_CATEGORIES = [
  "Booking",
  "Payments & Billing",
  "Cancellation & Refunds",
  "Check-in & Stay",
  "Account & Security",
  "Promotions & Recommendations",
] as const

export const FAQ_ITEMS: FaqItem[] = [
  // ── Booking ────────────────────────────────────────────────────────────────
  {
    id: "how-to-book",
    category: "Booking",
    q: "How do I book a room?",
    keywords: ["book", "reservation", "reserve", "how to", "first time"],
    a: "Open Rooms & Suites, pick your dates in the search bar, then choose a room and press Book. Confirm your details on the booking page, and we'll email you once it's done.",
  },
  {
    id: "booking-confirmed",
    category: "Booking",
    q: "How do I know my booking is confirmed?",
    keywords: ["confirmed", "confirmation", "status", "email", "proof"],
    a: "Confirmed bookings show a Confirmed status on your My Bookings page, and we send a confirmation email. Your booking QR code is also shown there for front-desk verification.",
  },
  {
    id: "extend-stay",
    category: "Booking",
    q: "Can I extend my stay?",
    keywords: ["extend", "extension", "longer", "add night", "more hours"],
    a: "Yes. Open the booking in My Bookings and choose extend, then pay for the extra hours online. Your updated schedule applies right after the payment succeeds.",
  },

  // ── Payments & Billing ─────────────────────────────────────────────────────
  {
    id: "payment-methods",
    category: "Payments & Billing",
    q: "What payment methods can I use?",
    keywords: ["payment", "pay", "gcash", "maya", "paymaya", "card", "method", "online"],
    a: "We accept GCash, Maya, and debit or credit cards through PayMongo's secure checkout. You can pay the full amount online or just the 50% downpayment.",
  },
  {
    id: "downpayment",
    category: "Payments & Billing",
    q: "Can I pay only part of the price now?",
    keywords: ["downpayment", "balance", "half", "partial", "50%", "installment"],
    a: "Yes. The downpayment option charges 50% online, and you settle the remaining balance in cash or card at the front desk before check-in.",
  },
  {
    id: "view-payments",
    category: "Payments & Billing",
    q: "Where can I see my payment and bookings?",
    keywords: ["receipt", "where", "view", "see", "history", "payment status"],
    a: "Every booking and its payment status appear on your My Bookings page, and we email you a copy of the confirmation. Signed-in users also get in-app notifications for every status change.",
  },

  // ── Cancellation & Refunds ─────────────────────────────────────────────────
  {
    id: "how-to-cancel",
    category: "Cancellation & Refunds",
    q: "How do I cancel a booking?",
    keywords: ["cancel", "cancellation", "stop", "reservation"],
    a: "Go to My Bookings, open the booking, and press Cancel. You'll pick a reason, and the cancellation takes effect right away, no phone call needed.",
  },
  {
    id: "refund-policy",
    category: "Cancellation & Refunds",
    q: "Will I get a refund if I cancel?",
    keywords: ["refund", "money back", "returned", "reimburse"],
    a: "Cancel at least 24 hours before check-in and everything you paid online is refunded automatically: 100% for full payments, or the 50% downpayment. It returns to your original payment method within 7-14 banking days.",
  },
  {
    id: "no-refund",
    category: "Cancellation & Refunds",
    q: "Why is my cancellation non-refundable?",
    keywords: ["non refundable", "no refund", "inside 24", "no show", "noshow", "late"],
    a: "Cancelling less than 24 hours before check-in, or not showing up at all, is non-refundable. A no-show keeps the 50% downpayment as a fee, and any remaining balance must be settled at the front desk before your next booking.",
  },

  // ── Check-in & Stay ────────────────────────────────────────────────────────
  {
    id: "check-in-times",
    category: "Check-in & Stay",
    q: "What are the check-in and check-out times?",
    keywords: ["check in", "check-in", "check out", "checkout", "time", "2pm", "2 pm", "arrive"],
    a: "Check-in starts at 2:00 PM, and overnight stays are exactly 24 hours, so your auto check-out is 2:00 PM the next day. Once checked in, changes go through the front desk.",
  },
  {
    id: "day-use",
    category: "Check-in & Stay",
    q: "What is a Day Use booking?",
    keywords: ["day use", "dayuse", "daytime", "hours", "short", "rest"],
    a: "Day Use books a room for 3, 6, 8, or 12 hours with your own start time, great for a short rest or a quick work trip. Day rates are separate from overnight rates and appear when you pick Day Use.",
  },
  {
    id: "qr-check-in",
    category: "Check-in & Stay",
    q: "Do I need to print anything for check-in?",
    keywords: ["qr", "print", "code", "verification", "document", "id"],
    a: "No printing needed. Just show your booking QR code from My Bookings (or your confirmation email) at the front desk, and our team will take it from there.",
  },

  // ── Account & Security ─────────────────────────────────────────────────────
  {
    id: "cant-login",
    category: "Account & Security",
    q: "I can't sign in to my account.",
    keywords: ["login", "log in", "sign in", "password", "forgot", "otp", "code", "google", "locked"],
    a: "Use the Forgot password link on the sign-in page to reset your password, or switch to the one-time code (OTP) or Google sign-in options. Still stuck? Contact the front desk and we'll help verify your account.",
  },
  {
    id: "change-profile",
    category: "Account & Security",
    q: "How do I change my name or photo?",
    keywords: ["name", "avatar", "photo", "profile", "edit", "picture"],
    a: "Edit your name and photo from Profile or Settings. For security, a name change can only be done once every 7 days, and your photo can be an uploaded avatar or your Google profile picture.",
  },
  {
    id: "data-safety",
    category: "Account & Security",
    q: "Is my account and data safe?",
    keywords: ["security", "safe", "secure", "data", "privacy", "stolen", "hacker"],
    a: "Yes. Sessions use expiring tokens, sign-ins from unknown devices trigger alerts, and we never store your card details because payments run through PayMongo. See the Privacy Policy for the full details.",
  },

  // ── Promotions & Recommendations ───────────────────────────────────────────
  {
    id: "promos",
    category: "Promotions & Recommendations",
    q: "How do promos and discounts apply?",
    keywords: ["promo", "discount", "sale", "code", "cheaper", "offer", "deal"],
    a: "Approved promotions apply automatically during booking when your stay qualifies, and you'll see the discounted price before you pay. Watch the Rooms pages for current offers.",
  },
  {
    id: "recommendations",
    category: "Promotions & Recommendations",
    q: "How does the system pick rooms for me?",
    keywords: ["recommend", "recommendation", "suggestion", "suggest", "best room", "ai"],
    a: "The system matches rooms by real-time availability for your dates and stay type, then ranks the results using your search preferences, such as dates, guests, and room type. Best rates and active promos show up alongside the results.",
  },
]

/** Shortlist shown under the search box for one-tap answers. */
export const POPULAR_SEARCHES: { label: string; id: string }[] = [
  { label: "Will I get a refund?", id: "refund-policy" },
  { label: "How do I cancel?", id: "how-to-cancel" },
  { label: "Payment methods", id: "payment-methods" },
  { label: "Check-in time", id: "check-in-times" },
]
