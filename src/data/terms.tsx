import { AlertCircle, CalendarDays, CreditCard, EyeOff, ShieldCheck, UserCheck } from "lucide-react"

export const LAST_UPDATED = "October 8, 2026"

export interface TermsSection {
  id: string
  title: string
  icon: React.ReactNode
  points: string[]
}

export const SECTIONS: TermsSection[] = [
  {
    id: "service",
    title: "Terms of Service",
    icon: <ShieldCheck className="size-4" />,
    points: [
      "By using Hotel Ava's booking system you agree to these terms. Reservations must be made in good faith with accurate guest information.",
      "You are responsible for keeping your account credentials secure and for every booking made through your account.",
      "Guests are expected to follow hotel policies on check-in/check-out times, occupancy limits, and conduct within the property.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    icon: <EyeOff className="size-4" />,
    points: [
      "We collect your name, email, and booking details solely to manage reservations and communicate with you about your stay.",
      "Payment card details are processed by PayMongo. Hotel Ava does not store your card number or CVV.",
      "We do not sell or rent your personal information to third parties.",
      "Hotel Ava does not use tracking or advertising cookies. Your sign-in session, preferences, and short-lived data caches are kept in your browser's local storage instead, and signing out clears your session. External services such as PayMongo's checkout may use their own cookies under their own policies.",
      "You can delete your account from Settings > Login & security — you'll be asked to re-authenticate, and any active bookings must be completed or cancelled first. The deletion is scheduled immediately and becomes permanent after a 30-day grace period, which you can cancel at any time. New bookings are disabled while deletion is pending.",
      "When an account is deleted, your profile, avatar, saved devices, and notifications are removed. Booking and payment records are kept only in anonymized form (amounts and dates, without your name or email) for the hotel's accounting and legal records.",
    ],
  },
  {
    id: "payment",
    title: "Reservation & Payment",
    icon: <CreditCard className="size-4" />,
    points: [
      "Full payment — the entire stay amount is charged online when you book. The booking is confirmed as soon as payment clears.",
      "Downpayment — 50% of the stay is charged online. The remaining 50% balance is settled in cash or card at the hotel front desk before check-in.",
      "A booking is only confirmed once payment has been received. Unpaid bookings are cancelled automatically once your check-in date has passed.",
      "Rates are quoted in Philippine Peso (₱). A 12% taxes & fees is added to the room rate and shown in your booking summary before you pay.",
      "Hotel Ava never sees or stores your card number or CVV — card data is entered directly on PayMongo's secure page.",
    ],
  },
  {
    id: "checkin",
    title: "Check-in & Check-out",
    icon: <CalendarDays className="size-4" />,
    points: [
      "Overnight stays follow the hotel's standard clock: check-in from 2:00 PM on your check-in date and check-out by 12:00 NN on the following day. Nights are counted by calendar date, so Oct 3 to Oct 4 is exactly one night.",
      "Day-use stays begin at your selected start time for the number of hours you booked.",
      "Your booking stays active through your check-out date and is closed automatically once the stay window ends.",
      "Present your booking QR code at the front desk. Your stay starts running at the booked time whether or not the QR code has been scanned.",
      "Early arrival before the booked time is accommodated when possible, but the room is only released to you once your stay has started.",
    ],
  },
  {
    id: "cancellation",
    title: "Cancellation, No-Show & Refund Policy",
    icon: <AlertCircle className="size-4" />,
    points: [
      "Cancel free of charge up to 24 hours before your scheduled check-in. Do it yourself from your My Bookings page — no call needed.",
      "Cancel 24 hours or more ahead and everything you already paid online is refunded automatically: 100% for full payments, the 50% downpayment for downpayment bookings. It returns to your original payment method within 7–14 banking days.",
      "Canceling inside the 24-hour window is still possible, but the payment is NON-REFUNDABLE — the booking is closed and nothing is returned to you.",
      "NO-SHOW: if you do not arrive and do not check in on your booking date, your booking closes automatically once the stay window ends, and no refund is issued for any amount already paid.",
      "For downpayment bookings that are not used, the 50% paid online is retained by the hotel as a no-show fee. The remaining balance is never charged online, but the front desk must record it as settled before you can book again.",
      "Once your stay has started — or you have already checked in — cancellation is no longer possible through the app; please contact the front desk.",
      "If a refund cannot be processed automatically, our front desk contacts you to arrange it manually.",
    ],
  },
  {
    id: "reviews",
    title: "Reviews & Guest Conduct",
    icon: <UserCheck className="size-4" />,
    points: [
      "Only guests who have actually completed a stay — checked in and checked out — may leave a review, and only once per booking.",
      "Reviews must be based on a genuine stay. Abusive, misleading, or off-topic content is not allowed.",
      "You can edit or delete your own review at any time from your reviews page.",
    ],
  },
]
