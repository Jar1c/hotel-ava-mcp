import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { CheckCircle, XCircle, Info } from "lucide-react"

interface Toast {
  id: number
  title: string
  description?: string
  variant?: "default" | "error" | "success"
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, 4000)
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
      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-white rounded-[14px] shadow-[0_4px_20px_rgba(0,0,0,0.12)] px-4 py-3 w-[320px] animate-toast-slide flex items-start gap-3"
          >
            <div className="shrink-0 mt-0.5">
              {icons[t.variant || "default"]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink leading-tight">{t.title}</p>
              {t.description && (
                <p className="text-xs text-muted mt-0.5 leading-snug">{t.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
