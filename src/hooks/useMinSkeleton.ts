import { useEffect, useRef, useState } from "react"

/**
 * Keeps a skeleton on screen for at least `minMs` (default 500ms) so fast
 * responses don't flash it. Returns true while the caller should render
 * skeletons, false once the real content may replace them.
 */
export function useMinSkeleton(loading: boolean, minMs = 500): boolean {
  const [show, setShow] = useState(loading)
  const startedAt = useRef(0)

  useEffect(() => {
    if (loading) {
      startedAt.current = Date.now()
      setShow(true)
      return
    }
    const remaining = minMs - (Date.now() - startedAt.current)
    if (remaining <= 0) {
      setShow(false)
      return
    }
    const id = window.setTimeout(() => setShow(false), remaining)
    return () => window.clearTimeout(id)
  }, [loading, minMs])

  return show
}
