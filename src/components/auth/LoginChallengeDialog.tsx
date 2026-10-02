import { useEffect, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { authApi, type LoginChallenge, type LoginResponse } from "@/services/api"

const PRIMARY = "#82285f"

interface LoginChallengeDialogProps {
  challenge: LoginChallenge
  onVerified: (res: LoginResponse) => Promise<void>
  onClose: () => void
}

/**
 * Step-up verification for an unfamiliar device/location: shows the emailed
 * 6-digit code screen. Rendered by AuthProvider whenever a challenge is
 * pending (password logins render their own inline copy inside Login.tsx).
 */
export default function LoginChallengeDialog({ challenge, onVerified, onClose }: LoginChallengeDialogProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(60)

  // Resend cooldown — mirrors the backend's 60s throttle
  useEffect(() => {
    setResendIn(60)
    setCode("")
    setError(null)
    const id = window.setInterval(() => {
      setResendIn((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => window.clearInterval(id)
  }, [challenge.challenge_id])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.replace(/\s/g, "")
    if (trimmed.length < 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await authApi.verifyLoginChallenge({
        challenge_id: challenge.challenge_id,
        code: trimmed,
      })
      await onVerified(res)
      // onVerified clears the challenge → this dialog unmounts
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.")
      setBusy(false)
    }
  }

  const resend = async () => {
    if (resendIn > 0 || busy) return
    setError(null)
    try {
      await authApi.resendLoginChallenge(challenge.challenge_id)
      setResendIn(60)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.")
    }
  }

  const reasonText =
    challenge.reason === "new_location"
      ? "You're signing in from a location not seen for this account."
      : "You're signing in from a new device."

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div
            className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: `${PRIMARY}15` }}
          >
            <ShieldCheck className="h-6 w-6" style={{ color: PRIMARY }} />
          </div>
          <DialogTitle className="text-center">Verify it's you</DialogTitle>
          <DialogDescription className="text-center">
            {reasonText} We sent a 6-digit code to{" "}
            <span className="font-semibold text-ink">{challenge.email_masked}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full rounded-[10px] border border-hairline bg-canvas py-2.5 text-center text-xl font-semibold tracking-[0.4em] text-ink placeholder:text-muted-soft focus:outline-none focus:border-primary"
          />

          {error && <p className="text-center text-sm text-red-500">{error}</p>}

          <Button
            type="submit"
            disabled={busy || code.length < 6}
            className="w-full !rounded-[10px] font-medium disabled:opacity-50"
            style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying...
              </span>
            ) : (
              "Verify and continue"
            )}
          </Button>
        </form>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={resend}
            disabled={resendIn > 0}
            className="font-medium text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resendIn > 0 ? `Resend code (${resendIn}s)` : "Resend code"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="font-medium transition-colors hover:underline"
            style={{ color: PRIMARY }}
          >
            Back to sign in
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
