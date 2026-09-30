import { API_BASE } from "@/lib/apiBase"

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem("access_token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getApprovedDiscounts(): Promise<Set<string>> {
  try {
    const data = await apiFetch<{ approved: string[] }>("/discounts/approved")
    return new Set(data.approved)
  } catch {
    return new Set()
  }
}

export async function approveDiscount(eventRoomTypeKey: string): Promise<void> {
  await apiFetch("/discounts/approve", {
    method: "POST",
    body: JSON.stringify({ event_room_type_key: eventRoomTypeKey }),
  })
}

export async function dismissDiscount(eventRoomTypeKey: string): Promise<void> {
  await apiFetch("/discounts/dismiss", {
    method: "POST",
    body: JSON.stringify({ event_room_type_key: eventRoomTypeKey }),
  })
}

/** A scheduled offer the admin switched on - public, it drives the guest badge. */
export interface ActiveOffer {
  roomType: string
  discountPercent: number
  validFrom: string
  validTo: string
  baseRate: number
  discountedRate: number
}

export async function getActiveOffers(): Promise<ActiveOffer[]> {
  try {
    const data = await apiFetch<ActiveOffer[]>("/discounts/active")
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** Inclusive YYYY-MM-DD window check for an offer. */
export function offerCoversDate(offer: ActiveOffer, date: Date): boolean {
  const day = isoDay(date)
  if (offer.validFrom && day < offer.validFrom) return false
  if (offer.validTo && day > offer.validTo) return false
  return true
}
