import { useEffect } from "react"
import { useNotifications } from "@/contexts/NotificationContext"

export function useBellRing() {
  const { ringNonce } = useNotifications()

  useEffect(() => {
    if (!ringNonce) return
    const bell = document.querySelector<SVGElement>("[data-notification-bell] svg")
    const badge = document.querySelector<HTMLElement>("[data-notification-badge]")

    const pairs: Array<[Element | null, string, number]> = [
      [bell, "animate-bell-ring", 950],
      [badge, "animate-bell-badge-pop", 550],
    ]

    for (const [el, cls, ms] of pairs) {
      if (!el) continue
      el.classList.remove(cls)
      void el.getBoundingClientRect()
      el.classList.add(cls)
      window.setTimeout(() => el.classList.remove(cls), ms)
    }
  }, [ringNonce])
}
