import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

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

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-white border border-hairline rounded-[12px] shadow-lg px-4 py-3 max-w-sm animate-slide-in-right"
            style={{
              borderLeftWidth: "4px",
              borderLeftColor: t.variant === "error" ? "#A4423A" : t.variant === "success" ? "#3D6B4F" : "#82285f",
            }}
          >
            <p className="typo-body-sm font-medium text-ink">{t.title}</p>
            {t.description && (
              <p className="typo-caption-sm text-muted mt-0.5">{t.description}</p>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
