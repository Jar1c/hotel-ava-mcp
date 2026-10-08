export type LastSignIn = "password" | "google" | "quick"

const KEY = "ava:last-signin"

export function getLastSignIn(): LastSignIn | null {
  const v = localStorage.getItem(KEY)
  return v === "password" || v === "google" || v === "quick" ? v : null
}

export function setLastSignIn(method: LastSignIn): void {
  localStorage.setItem(KEY, method)
}
