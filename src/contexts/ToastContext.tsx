import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { CheckCircle, XCircle, Info } from "lucide-react"

interface Toast {
  id: number
  title: string
  description?: string
  variant?: "default" | "error" | "success"
  onClick?: () => void
  duration?: number
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const MAX_TOASTS = 3

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => {
      const next = [...prev, { ...t, id }]
      // Cap stack so history/race bugs can't flood the screen
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
    })
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, t.duration ?? 4000)
  }, [])

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
            onClick={() => {
              t.onClick?.()
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }}
            className={`pointer-events-auto bg-white dark:bg-surface-soft rounded-[14px] shadow-[0_4px_20px_rgba(0,0,0,0.12)] px-4 py-3 w-full max-w-[320px] sm:w-[320px] animate-toast-slide flex items-start gap-3 ${
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
