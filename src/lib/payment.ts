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
