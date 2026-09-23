import { useEffect, useRef, useCallback } from "react"

/**
 * Repeatedly calls `fetchFn` every `intervalMs` milliseconds.
 * The first call happens immediately on mount.
 * Returns nothing — just keeps state fresh via the setter you pass in.
 */
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  setter: (data: T) => void,
  intervalMs: number = 30000,
) {
  const fetchRef = useRef(fetchFn)
  const setterRef = useRef(setter)

  // Keep refs fresh without re-triggering the interval
  useEffect(() => { fetchRef.current = fetchFn }, [fetchFn])
  useEffect(() => { setterRef.current = setter }, [setter])

  const tick = useCallback(async () => {
    // Skip when tab is hidden — don't burn backend cycles in background
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return
    try {
      const data = await fetchRef.current()
      setterRef.current(data)
    } catch {
      // silently ignore — next tick will retry
    }
  }, [])

  useEffect(() => {
    // Fetch immediately
    tick()

    // Then on interval
    const id = setInterval(tick, intervalMs)

    // Catch up as soon as the tab becomes visible again
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [tick, intervalMs])
}
