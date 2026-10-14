import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { Search, Send, Bot, ChevronDown, Sparkles, X } from "lucide-react"
import { FAQ_CATEGORIES, FAQ_ITEMS, POPULAR_SEARCHES, type FaqItem } from "@/data/faq"
import { helpApi, ApiError } from "@/services/api"

interface ChatMessage {
  role: "user" | "ava"
  text: string
}

function scoreItem(item: FaqItem, tokens: string[], raw: string): number {
  let score = 0
  const q = item.q.toLowerCase()
  const a = item.a.toLowerCase()
  if (q.includes(raw)) score += 6
  for (const t of tokens) {
    if (t.length < 2) continue
    if (q.includes(t)) score += 3
    if (item.keywords.some((k) => k.includes(t) || (k.length >= 3 && t.includes(k)))) score += 3
    if (a.includes(t)) score += 1
    if (item.category.toLowerCase().includes(t)) score += 1
  }
  return score
}

function FaqCard({
  item,
  open,
  onToggle,
}: {
  item: FaqItem
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-[12px] border border-hairline bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="typo-body-sm font-semibold text-ink">{item.q}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="px-5 pb-5 typo-body-sm leading-relaxed text-muted">{item.a}</p>
      )}
    </div>
  )
}

export default function Help() {
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, busy])

  const results = useMemo(() => {
    const raw = query.trim().toLowerCase()
    if (!raw) return null
    const tokens = raw.split(/\s+/)
    if (!tokens.some((t) => t.length >= 2)) return null
    return FAQ_ITEMS.map((item) => ({ item, score: scoreItem(item, tokens, raw) }))
      .filter((r) => r.score >= 3)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.item)
  }, [query])

  const activeId =
    openId && results ? (results.some((r) => r.id === openId) ? openId : results[0]?.id ?? null)
    : results && results.length > 0 ? results[0]?.id ?? null
    : openId

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

  return (
    <div className="bg-canvas min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="text-center">
          <p className="typo-caption-sm uppercase tracking-[0.2em] text-primary">Hotel Ava</p>
          <h1 className="typo-display-lg mt-2 text-ink">Help Center</h1>
          <p className="typo-body-md mx-auto mt-3 max-w-[40rem] text-muted">
            Instant answers to common questions. Search the FAQ, or ask our AI assistant.
          </p>
        </header>

        <div className="mt-8 rounded-[12px] border border-hairline bg-white p-4">
          <div className="flex items-center gap-3">
            <Search className="size-4 shrink-0 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions, e.g. refund, check-in, payment..."
              aria-label="Search the FAQ"
              className="typo-body-sm w-full bg-transparent text-ink outline-none placeholder:text-muted/70"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="shrink-0 rounded-full p-1 text-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {!query && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">
              {POPULAR_SEARCHES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setQuery(s.label)}
                  className="typo-caption-sm rounded-full border border-hairline bg-canvas px-3 py-1.5 text-muted transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <section className="mt-6 rounded-[12px] border border-primary/25 bg-primary/[0.04] p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-white">
              <Sparkles className="size-4" />
            </span>
            <div>
              <h2 className="typo-title-md text-ink">Ask Ava</h2>
              <p className="typo-caption-sm text-muted">AI assistant, replies instantly</p>
            </div>
          </div>

          {messages.length > 0 && (
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <p
                    className={`typo-body-sm max-w-[85%] whitespace-pre-wrap rounded-[12px] px-3.5 py-2.5 ${
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
                <div className="flex items-center gap-2 text-muted">
                  <Bot className="size-4" />
                  <span className="typo-caption-sm">Ava is thinking...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {chatError && (
            <p className="typo-caption-sm mt-3 rounded-[8px] border border-[#F0C8C4] bg-[#FDF2F1] px-3 py-2 text-[#B3261E]">
              {chatError} Try rephrasing, or pick an answer from the FAQ below.
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendQuestion(input)
            }}
            className="mt-4 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={400}
              placeholder="Ask a question about your stay..."
              aria-label="Ask the AI assistant"
              className="typo-body-sm min-w-0 flex-1 rounded-[12px] border border-hairline bg-white px-3.5 py-2.5 text-ink outline-none placeholder:text-muted/70 focus:border-primary/50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send question"
              className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-primary text-white transition-opacity disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>

          <p className="typo-caption-sm mt-3 text-muted">
            AI answers are general guidance. The FAQ below reflects official Hotel Ava policy.
          </p>
        </section>

        <section className="mt-8">
          {results ? (
            results.length > 0 ? (
              <>
                <h2 className="typo-title-md text-ink">
                  {results.length} {results.length === 1 ? "answer" : "answers"} for "{query.trim()}"
                </h2>
                <div className="mt-4 space-y-3">
                  {results.map((item) => (
                    <FaqCard
                      key={item.id}
                      item={item}
                      open={activeId === item.id}
                      onToggle={() => setOpenId(activeId === item.id ? null : item.id)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-[12px] border border-hairline bg-white px-5 py-8 text-center">
                <p className="typo-body-md text-ink">No FAQ match for "{query.trim()}"</p>
                <p className="typo-body-sm mt-1 text-muted">
                  Try different words, or ask Ava in the chat above.
                </p>
              </div>
            )
          ) : (
            FAQ_CATEGORIES.map((category) => {
              const items = FAQ_ITEMS.filter((f) => f.category === category)
              if (items.length === 0) return null
              return (
                <div key={category} className="mb-7 last:mb-0">
                  <h2 className="typo-title-md text-ink">{category}</h2>
                  <div className="mt-3 space-y-3">
                    {items.map((item) => (
                      <FaqCard
                        key={item.id}
                        item={item}
                        open={activeId === item.id}
                        onToggle={() => setOpenId(activeId === item.id ? null : item.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </section>

        <nav className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-hairline pt-6">
          <Link to="/" className="typo-body-sm text-primary hover:underline">
            Back to Home
          </Link>
          <Link to="/rooms" className="typo-body-sm text-primary hover:underline">
            Rooms & Suites
          </Link>
          <Link to="/my-bookings" className="typo-body-sm text-primary hover:underline">
            My Bookings
          </Link>
        </nav>
      </div>
    </div>
  )
}
