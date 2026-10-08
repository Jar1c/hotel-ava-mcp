import { useCallback, useEffect, useRef, useState } from "react"
import { Check } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useAuth } from "@/contexts/AuthContext"
import { qrLogoSettings } from "@/lib/qrLogo"
import { quickSigninApi, type LoginResponse } from "@/services/api"

interface QuickSignInPanelProps {
  /** Called after the code is approved and the session is applied. */
  onSignedIn?: (res: LoginResponse) => void
  onBack?: () => void
  /**
   * "stacked" (default): centered single column — the /login page embed.
   * "wide": fat two-column variant (QR left, info right) used by the sign-in
   * modals; stacks vertically below the sm breakpoint.
   */
  layout?: "stacked" | "wide"
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
 *
 * Minimal layout (WhatsApp/Discord-style): QR → "Or enter this code" line →
 * code + Copy → single status line → how-it-works link → Back to sign in.
 * Status area is an aria-live region.
 */
export default function QuickSignInPanel({ onSignedIn, onBack, layout = "stacked" }: QuickSignInPanelProps) {
  const wide = layout === "wide"
  const { completeSession } = useAuth()
  const [code, setCode] = useState("")
  const [secondsLeft, setSecondsLeft] = useState(300)
  const [phase, setPhase] = useState<"loading" | "waiting" | "approved" | "expired" | "error">("loading")
  const [message, setMessage] = useState("")
  const [copied, setCopied] = useState(false)
  const approveTimeout = useRef<number | null>(null)

  const generate = useCallback(async () => {
    setPhase("loading")
    setMessage("")
    setCode("")
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

  // Clear the pending "show approved, then close" timer on unmount.
  useEffect(
    () => () => {
      if (approveTimeout.current) window.clearTimeout(approveTimeout.current)
    },
    [],
  )

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
            setPhase("approved")
            // Brief "Signing you in…" beat before the session is applied.
            approveTimeout.current = window.setTimeout(() => {
              void completeSession(res).then(() => onSignedIn?.(res))
            }, 1100)
            return
          }
          if (st.status === "expired") {
            window.clearInterval(id)
            setPhase("expired")
            return
          }
          if (st.status === "invalid" || st.status === "consumed") {
            window.clearInterval(id)
            setPhase("expired")
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

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable — the code stays selectable */
    }
  }

  const hasCode = code.length > 0
  const showCodeBlock = hasCode && phase !== "loading"
  const dimmed = phase !== "waiting"

  return (
    <div className="text-center">
      <div
        className={
          wide
            ? "flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-7"
            : "flex flex-col items-center"
        }
      >
        {/* QR (minimal spinner while generating) */}
        <div className={`flex justify-center ${wide ? "shrink-0" : ""}`}>
          {phase === "loading" ? (
            <div className="skeleton h-[194px] w-[194px] rounded-[8px]" aria-hidden="true" />
          ) : hasCode ? (
            <div
              className={`rounded-[8px] border border-hairline bg-white p-1.5 transition-opacity ${dimmed ? "opacity-40 grayscale" : ""}`}
              role="img"
              aria-label="QR code for quick sign-in — scan it with your other device"
            >
              <QRCodeSVG
                value={`${window.location.origin}/settings?tab=quick-signin&code=${code}`}
                size={180}
                level="H"
                imageSettings={qrLogoSettings(180)}
              />
            </div>
          ) : (
            <div className="h-[194px]" aria-hidden="true" />
          )}
        </div>

        {/* Info column — QR sibling on wide, below it on stacked/mobile */}
        <div
          className={`flex min-w-0 flex-1 flex-col items-center ${wide ? "sm:items-start sm:text-left" : ""}`}
        >
          {showCodeBlock && (
            <>
              <p className={`mb-2 mt-6 text-[13px] text-muted ${wide ? "sm:mt-0" : ""}`}>
                Or enter this code on your phone
              </p>
              <div className="flex items-center justify-center gap-2">
                <p className="font-mono text-xl font-medium tracking-[0.08em] text-ink select-all">
                  {formatCode(code)}
                </p>
                <button
                  type="button"
                  onClick={copyCode}
                  aria-label={copied ? "Code copied" : "Copy sign-in code"}
                  className="text-[13px] font-medium text-muted transition-colors hover:text-primary"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </>
          )}

          {/* Skeleton while the code is being created — mirrors the final
              label + code + copy layout so nothing jumps when it arrives. */}
          {phase === "loading" && (
            <div aria-hidden="true" className="flex flex-col items-center">
              <div className={`mb-2 mt-6 flex h-5 items-center ${wide ? "sm:mt-0" : ""}`}>
                <div className="skeleton h-[13px] w-[190px] rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <div className="skeleton h-6 w-[150px] rounded-[6px]" />
                <div className="skeleton h-[13px] w-[34px] rounded-full" />
              </div>
            </div>
          )}

          {/* Status — announced politely to screen readers */}
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex min-h-[36px] flex-col items-center justify-center gap-3"
          >
            {phase === "loading" && <p className="text-[13px] text-muted">Creating a new code…</p>}

            {phase === "waiting" && (
              <p className="flex items-center justify-center gap-1.5 text-[13px] text-muted">
                <span className="qs-dot inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                <span>Waiting for approval</span>
                <span aria-hidden="true">·</span>
                <span className={secondsLeft <= 60 ? "font-medium text-red-600" : ""}>
                  Expires in {formatLeft(secondsLeft)}
                </span>
              </p>
            )}

            {phase === "approved" && (
              <p className="flex items-center gap-1.5 text-[13px] text-ink">
                <span className="qs-check-pop inline-flex items-center">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                Signing you in…
              </p>
            )}

            {phase === "expired" && <p className="text-[13px] text-ink">Code expired</p>}

            {phase === "error" && (
              <p className="text-[13px] text-muted">
                {message || "Could not create a sign-in code."}{" "}
                <button
                  type="button"
                  onClick={() => void generate()}
                  className="font-medium text-primary hover:underline"
                >
                  Try again
                </button>
              </p>
            )}
          </div>

          {/* Restart action (expired) */}
          {phase === "expired" && (
            <button
              type="button"
              onClick={() => void generate()}
              className="mt-3 rounded-[8px] bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Generate new code
            </button>
          )}

          {/* How does this work? — plain link, collapsed by default */}
          <details className={`mx-auto mt-6 max-w-[320px] text-left ${wide ? "sm:mx-0" : ""}`}>
            <summary className="inline-block cursor-pointer list-none text-sm font-medium text-primary hover:underline [&::-webkit-details-marker]:hidden">
              How does this work?
            </summary>
            <ol className="mt-3 space-y-1 text-left text-[13px] leading-relaxed text-muted list-inside list-decimal marker:text-muted">
              <li>
                On your signed-in phone, open{" "}
                <span className="font-medium text-ink">Settings → Quick Sign-In</span>.
              </li>
              <li>
                Tap <span className="font-medium text-ink">Scan QR</span> and point it at this QR
                code — or type the code above.
              </li>
              <li>It approves automatically — you're signed in.</li>
            </ol>
          </details>
        </div>
      </div>

      {/* Back to sign in */}
      {onBack && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to sign in
          </button>
        </div>
      )}
    </div>
  )
}
