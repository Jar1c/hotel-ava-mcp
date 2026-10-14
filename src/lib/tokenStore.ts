const ACCESS_KEY = "access_token"
const REFRESH_KEY = "refresh_token"

function readKey(key: string): string | null {
  const current = localStorage.getItem(key)
  if (current) return current
  const legacy = sessionStorage.getItem(key)
  if (legacy) {
    localStorage.setItem(key, legacy)
    sessionStorage.removeItem(key)
    return legacy
  }
  return null
}

export function getAccessToken(): string | null {
  return readKey(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return readKey(REFRESH_KEY)
}

export function setAccess(token: string): void {
  localStorage.setItem(ACCESS_KEY, token)
  sessionStorage.removeItem(ACCESS_KEY)
}

export function setRefresh(token: string): void {
  localStorage.setItem(REFRESH_KEY, token)
  sessionStorage.removeItem(REFRESH_KEY)
}

export function clearTokens(): void {
  for (const key of [ACCESS_KEY, REFRESH_KEY]) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  }
}
