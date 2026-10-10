import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { Sparkles, Send, X, MessageCircleQuestion } from "lucide-react"
import { helpApi, ApiError } from "@/services/api"

interface ChatMessage {
  role: "user" | "ava"
  text: string
}

const SUGGESTIONS = [
  "How do I cancel my booking?",
  "Will I get a refund?",
  "What payment methods are accepted?",
  "What time is check-in?",
  "Can I extend my stay?",
  "How does Day Use work?",
]

const APPLE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)"

export default function FloatingHelp() {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openPanel = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }, [])

  const closePanel = useCallback(() => {
    setVisible(false)
    closeTimer.current = setTimeout(() => setOpen(false), 280)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, busy, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, closePanel])

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  async function sendQuestion(question: string) {
    const q = question.trim()
    if (!q || busy) return
    setMessages((prev) => [...prev, { role: "user", text: q }])
    setInput("")
    setChatError(null)
    setBusy(true)
    try {
      const { answer } = await helpApi.ask(q)
      setMessages((prev) => [...prev, { role: "ava", text: answer }])
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "The AI assistant is unavailable right now, please browse the FAQ."
      setChatError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        aria-label="Open Ask Ava"
        className="fixed bottom-24 right-4 z-[91] flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 md:bottom-6 md:right-6"
        style={{ transitionTimingFunction: APPLE_EASE }}
      >
        <Sparkles className="size-6" />
      </button>
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[89] transition-opacity duration-300 md:bg-transparent"
        style={{
          background: "rgba(0,0,0,0.12)",
          opacity: visible ? 1 : 0,
          transitionTimingFunction: APPLE_EASE,
          pointerEvents: visible ? "auto" : "none",
        }}
        onClick={closePanel}
        aria-hidden
      />

      <div
        className="fixed bottom-24 left-4 right-4 z-[90] flex max-h-[70vh] flex-col overflow-hidden rounded-[16px] border border-hairline bg-white shadow-2xl md:bottom-24 md:left-auto md:right-6 md:w-[380px]"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.92) translateY(12px)",
          transformOrigin: "bottom right",
          transition: `opacity 280ms ${APPLE_EASE}, transform 280ms ${APPLE_EASE}`,
        }}
        role="dialog"
        aria-label="Ask Ava chat"
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-9 items-center justify-center rounded-full bg-primary text-white">
              <Sparkles className="size-4" />
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-success" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Ask Ava</p>
              <p className="text-[11px] text-muted">Hotel Ava Assistant · Online</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Close chat"
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-surface-soft hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-canvas px-4 py-4">
          {messages.length === 0 ? (
            <>
              <div className="text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageCircleQuestion className="size-6" />
                </span>
                <p className="mt-2.5 text-sm font-semibold text-ink">Hi, I'm Ava</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">
                  Ask me anything about your booking, payments, or stay.
                </p>
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Frequently asked
              </p>
              <div className="space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendQuestion(s)}
                    disabled={busy}
                    className="w-full rounded-[10px] border border-hairline bg-white px-3.5 py-2.5 text-left text-[13px] text-ink transition-colors hover:border-primary/40 hover:bg-primary/[0.03] disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "ava" && (
                    <span className="mt-1 mr-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                      <Sparkles className="size-3" />
                    </span>
                  )}
                  <p
                    className={`max-w-[80%] whitespace-pre-wrap rounded-[12px] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-white"
                        : "border border-hairline bg-white text-ink"
                    }`}
                  >
                    {m.text}
                  </p>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 pl-9">
                  <span className="flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted" />
                  </span>
                  <span className="text-[12px] text-muted">Ava is thinking...</span>
                </div>
              )}
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {chatError && (
          <p className="border-t border-hairline bg-[#FDF2F1] px-4 py-2 text-[12px] text-[#B3261E]">
            {chatError}
          </p>
        )}

        <div className="border-t border-hairline bg-white px-3 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendQuestion(input)
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={400}
              placeholder="Type your question..."
              aria-label="Ask the AI assistant"
              className="min-w-0 flex-1 rounded-[10px] border border-hairline bg-canvas px-3.5 py-2.5 text-[13px] text-ink outline-none placeholder:text-muted/60 focus:border-primary/50 focus:bg-white"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send question"
              className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-white transition-all hover:bg-primary-active disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
          <Link
            to="/help"
            onClick={closePanel}
            className="mt-2 block text-center text-[12px] font-medium text-primary/80 hover:text-primary hover:underline"
          >
            Browse full Help Center
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={closePanel}
        aria-label="Close Ask Ava"
        className="fixed bottom-24 right-4 z-[91] flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 md:bottom-6 md:right-6"
        style={{ transitionTimingFunction: APPLE_EASE }}
      >
        <X className="size-6" />
      </button>
    </>
  )
}
