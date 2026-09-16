const API_BASE = import.meta.env.VITE_API_URL || "/api"

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
