const memory = new Map<string, { data: unknown; ts: number }>()
const MEMORY_TTL = 60_000       // 1 min — in-memory fresh window
const STORAGE_TTL = 300_000     // 5 min — localStorage fresh window

function storageKey(key: string) { return `cache_${key}` }

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey(key))
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts >= STORAGE_TTL) {
      localStorage.removeItem(storageKey(key))
      return null
    }
    return data as T
  } catch { return null }
}

function writeStorage(key: string, data: unknown) {
  try {
    localStorage.setItem(storageKey(key), JSON.stringify({ data, ts: Date.now() }))
  } catch { /* quota exceeded — ignore */ }
}

// L1: memory fast path
export function getCached<T>(key: string): T | null {
  const hit = memory.get(key)
  if (hit && Date.now() - hit.ts < MEMORY_TTL) return hit.data as T
  // L2: localStorage fallback
  const stored = readStorage<T>(key)
  if (stored !== null) {
    memory.set(key, { data: stored, ts: Date.now() }) // warm L1
    return stored
  }
  return null
}

// Stale-while-revalidate: return any cached data regardless of age
export function getStale<T>(key: string): T | null {
  const hit = memory.get(key)
  if (hit) return hit.data as T
  return readStorage<T>(key)
}

export function isStale(key: string): boolean {
  const hit = memory.get(key)
  if (!hit) return true
  return Date.now() - hit.ts >= MEMORY_TTL
}

export function setCache(key: string, data: unknown) {
  memory.set(key, { data, ts: Date.now() })
  writeStorage(key, data)
}

export function clearCache(key?: string) {
  if (key) {
    memory.delete(key)
    localStorage.removeItem(storageKey(key))
  } else {
    memory.clear()
    // Clear only our cache keys, not all localStorage
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith("cache_")) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  }
}
