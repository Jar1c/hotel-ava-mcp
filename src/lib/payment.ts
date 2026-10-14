/**
 * Payment method labels.
 *
 * Bookings created through PayMongo store an "awaiting:<session_id>" marker
 * until the real method (chosen inside PayMongo's hosted page) is read back
 * by the backend, so labels must normalise that marker too.
 */
export function formatPaymentMethod(method?: string | null, fallback = "Not set"): string {
  if (!method) return fallback
  if (method.startsWith("awaiting:")) return "Pending"
  if (method.startsWith("extend:")) return "Pending"
  const m = method.toLowerCase()
  if (m === "gcash") return "GCash"
  if (m === "paymaya") return "Maya"
  if (m === "card") return "Credit / Debit Card"
  if (m === "qrph") return "QR Ph"
  if (m === "paymongo") return "PayMongo"
  return method.charAt(0).toUpperCase() + method.slice(1)
}

/**
 * What a downpayment booking charged online — the backend's downpayment_amount():
 * half the total, rounded the way Python rounds (halves go to the even side),
 * never 0. Once the balance is settled, amount_paid is the SUM, so receipts
 * need this original split to print "paid online" vs "settled at the hotel".
 */
export function downpaymentOnline(total: number): number {
  const half = Math.max(0, total || 0) * 0.5
  const floor = Math.floor(half)
  const rounded = half - floor === 0.5 ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(half)
  return Math.max(1, rounded)
}
