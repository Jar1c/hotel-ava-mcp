import { AlertCircle, CalendarDays, CreditCard, EyeOff, ShieldCheck, UserCheck } from "lucide-react"

export const LAST_UPDATED = "September 30, 2026"

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
    ],
  },
  {
    id: "payment",
    title: "Reservation & Payment",
    icon: <CreditCard className="size-4" />,
    points: [
      "Full payment — the entire stay amount is charged online when you book. The booking is confirmed as soon as payment clears.",
      "Downpayment — 50% of the stay is charged online. The remaining 50% balance is settled in cash or card at the hotel front desk before check-in.",
      "A booking is only confirmed once payment has been received. Unpaid bookings are cancelled automatically on the check-in date.",
      "Rates are quoted in Philippine Peso (₱) and include applicable taxes unless stated otherwise.",
      "Hotel Ava never sees or stores your card number or CVV — card data is entered directly on PayMongo's secure page.",
    ],
  },
  {
    id: "checkin",
    title: "Check-in & Check-out",
    icon: <CalendarDays className="size-4" />,
    points: [
      "Overnight stays run for 24 hours: they start at your chosen check-in time on the check-in date and end at the same clock time on the check-out date — a 10:00 PM check-in on Oct 3 is a 10:00 PM check-out on Oct 4. Nights are counted by calendar date, so Oct 3 to Oct 4 is exactly one night.",
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
      "For downpayment bookings that are not used, the 50% paid online is retained by the hotel as a no-show fee. Any unpaid balance is simply waived — it is never charged to you.",
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
      "Reviews must be based on a genuine stay. Content that is abusive, misleading, or unrelated to the property may be removed.",
      "Hotel Ava may decline or remove reviews that violate these terms.",
    ],
  },
]
