import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { CheckCircle, XCircle, Info } from "lucide-react"

interface Toast {
  id: number
  title: string
  description?: string
  variant?: "default" | "error" | "success"
  onClick?: () => void
  duration?: number
  origin?: { x: number; y: number }
  exiting?: boolean
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const MAX_TOASTS = 3
const EXIT_MS = 240

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, exiting: true } : x)))
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, EXIT_MS)
  }, [])

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => {
      const next = [...prev, { ...t, id }]
      // Cap stack so history/race bugs can't flood the screen
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
    })
    setTimeout(() => dismissToast(id), t.duration ?? 4000)
  }, [dismissToast])

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-[#3D6B4F]" />,
    error: <XCircle className="h-5 w-5 text-[#A4423A]" />,
    default: <Info className="h-5 w-5" style={{ color: "var(--color-primary)" }} />,
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container - top right like phone notifications */}
      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-sm:right-2 max-sm:left-2 max-sm:top-16">
        {toasts.map((t) => (
          <div
            key={t.id}
            ref={(el) => {
              if (!el || !t.origin || el.dataset.flown) return
              el.dataset.flown = "1"
              const r = el.getBoundingClientRect()
              const dx = t.origin.x - (r.left + r.width / 2)
              const dy = t.origin.y - (r.top + r.height / 2)
              el.animate(
                [
                  { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.25)` },
                  { opacity: 1, transform: "translate(0px, 0px) scale(1)" },
                ],
                { duration: 520, easing: "cubic-bezier(0.34, 1.45, 0.64, 1)" },
              )
            }}
            onClick={() => {
              t.onClick?.()
              dismissToast(t.id)
            }}
            className={`pointer-events-auto bg-white dark:bg-surface-soft rounded-[14px] shadow-[0_4px_20px_rgba(0,0,0,0.12)] px-4 py-3 w-full max-w-[320px] sm:w-[320px] flex items-start gap-3 ${
              t.origin ? "" : "animate-toast-slide"
            } ${t.exiting ? "animate-toast-exit" : ""} ${
              t.onClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-strong transition-colors" : ""
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {icons[t.variant || "default"]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink leading-tight">{t.title}</p>
              {t.description && (
                <p className="text-xs text-muted mt-0.5 leading-snug">{t.description}</p>
              )}
              {t.onClick && (
                <p className="text-[11px] text-primary mt-1 font-medium">Tap to view</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
