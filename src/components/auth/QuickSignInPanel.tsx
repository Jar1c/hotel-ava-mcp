import { useCallback, useEffect, useState } from "react"
import { Loader2, QrCode, RefreshCw } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useAuth } from "@/contexts/AuthContext"
import { quickSigninApi, type LoginResponse } from "@/services/api"

const PRIMARY = "#82285f"

interface QuickSignInPanelProps {
  /** Called after the code is approved and the session is applied. */
  onSignedIn?: (res: LoginResponse) => void
  onBack?: () => void
}

function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code
}

function formatLeft(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, "0")}`
}

/**
 * Roblox-style Quick Sign-In: this (signed-out) device shows a short-lived
 * code; approving it from Settings → Quick Sign-In on an already-signed-in
 * device signs this device in. Polls the backend until approved.
 */
export default function QuickSignInPanel({ onSignedIn, onBack }: QuickSignInPanelProps) {
  const { completeSession } = useAuth()
  const [code, setCode] = useState("")
  const [secondsLeft, setSecondsLeft] = useState(300)
  const [phase, setPhase] = useState<"loading" | "waiting" | "expired" | "error">("loading")
  const [message, setMessage] = useState("")
  const [regenerating, setRegenerating] = useState(false)

  const generate = useCallback(async () => {
    setPhase("loading")
    setMessage("")
    try {
      const res = await quickSigninApi.request()
      setCode(res.code)
      setSecondsLeft(300)
      setPhase("waiting")
    } catch (err) {
      setPhase("error")
      setMessage(err instanceof Error ? err.message : "Could not create a sign-in code.")
    }
  }, [])

  useEffect(() => {
    void generate()
  }, [generate])

  // Countdown + approval poll (every 2nd second)
  useEffect(() => {
    if (phase !== "waiting" || !code) return
    let ticks = 0
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
      ticks += 1
      if (ticks % 2 !== 0) return
      quickSigninApi
        .status(code)
        .then(async (st) => {
          if (st.status === "approved" && st.access_token && st.refresh_token && st.user) {
            window.clearInterval(id)
            const res: LoginResponse = {
              access_token: st.access_token,
              refresh_token: st.refresh_token,
              user: st.user,
            }
            await completeSession(res)
            onSignedIn?.(res)
            return
          }
          if (st.status === "expired") {
            window.clearInterval(id)
            setPhase("expired")
            setMessage("This code expired. Generate a new one.")
            return
          }
          if (st.status === "invalid" || st.status === "consumed") {
            window.clearInterval(id)
            setPhase("expired")
            setMessage("This code is no longer active. Generate a new one.")
            return
          }
          if (typeof st.seconds_left === "number") setSecondsLeft(st.seconds_left)
        })
        .catch(() => {
          /* transient network error — keep polling */
        })
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase, code, completeSession, onSignedIn])

  const needsRestart = phase === "expired" || phase === "error"

  return (
    <div className="text-center">
      <div
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: `${PRIMARY}15` }}
      >
        <QrCode className="h-6 w-6" style={{ color: PRIMARY }} />
      </div>

      <p className="text-xs font-medium uppercase tracking-wider text-muted">Sign-in code</p>

      {phase === "loading" && !code ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      ) : (
        <p
          className="my-2 font-mono text-3xl font-bold tracking-[0.2em] text-ink select-all"
          style={{ minHeight: "2.5rem" }}
        >
          {formatCode(code)}
        </p>
      )}

      {phase === "waiting" && (
        <p className="text-xs text-muted">
          Expires in {formatLeft(secondsLeft)} · waiting for approval…
        </p>
      )}

      {phase === "waiting" && code && (
        <div className="mt-4 flex justify-center">
          <div
            className="rounded-[8px] border border-hairline bg-white p-2"
            role="img"
            aria-label="QR code for quick sign-in — scan it with your other device"
          >
            <QRCodeSVG
              value={`${window.location.origin}/settings?tab=quick-signin&code=${code}`}
              size={112}
              level="M"
            />
          </div>
        </div>
      )}

      <ol className="mx-auto mt-3 max-w-[300px] space-y-1 text-left text-xs leading-relaxed text-muted list-inside list-decimal marker:font-semibold marker:text-primary">
        <li>
          On your signed-in phone, open{" "}
          <span className="font-semibold text-ink">Settings → Quick Sign-In</span>.
        </li>
        <li>
          Tap <span className="font-semibold text-ink">Scan QR</span> and point it at this QR
          code — or type the code above.
        </li>
        <li>It approves automatically — you're signed in.</li>
      </ol>

      {(message || needsRestart) && (
        <p className="mt-3 text-sm text-red-500">{message}</p>
      )}

      <div className="mt-4 flex items-center justify-center gap-3">
        {needsRestart && (
          <button
            type="button"
            onClick={() => {
              setRegenerating(true)
              void generate().finally(() => setRegenerating(false))
            }}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-hairline bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-soft disabled:opacity-50"
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Generate new code
          </button>
        )}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Back
          </button>
        )}
      </div>
    </div>
  )
}
