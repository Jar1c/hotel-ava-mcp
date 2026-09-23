import { useState } from "react"
import { useNavigate } from "react-router"
import { X, Loader2, Mail } from "lucide-react"

const PRIMARY = "#82285f"

interface GoogleSignInModalProps {
  open: boolean
  onClose: () => void
}

export default function GoogleSignInModal({ open, onClose }: GoogleSignInModalProps) {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  if (!open) return null

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const { supabase } = await import("@/lib/supabase")
      // Return the user to the page they were on when the modal opened
      const returnToUrl = `${window.location.pathname}${window.location.search}`
      sessionStorage.setItem("postOAuthReturnTo", returnToUrl)
      sessionStorage.setItem("postOAuthReturnToAt", String(Date.now()))
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${returnToUrl}`,
        },
      })

      if (error) {
        console.error("[GoogleSignIn] OAuth error:", error)
        setLoading(false)
      }
    } catch (err) {
      console.error("[GoogleSignIn] Error:", err)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-[12px] shadow-lg p-8 text-center animate-scale-in relative overflow-visible"
        style={{ width: "100%", maxWidth: "360px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-gray-100 transition-colors cursor-pointer z-10 disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="mx-auto mb-5 flex items-center justify-center w-14 h-14 rounded-full" style={{ backgroundColor: `${PRIMARY}15` }}>
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-ink mb-2">Sign in to Hotel Ava</h2>
        <p className="text-sm text-muted mb-6">Continue with your Google account to start booking.</p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-[10px] border border-hairline bg-white hover:bg-surface-soft transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span className="text-sm text-ink/80">{loading ? "Opening Google..." : "Continue with Google"}</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-hairline" />
          <span className="text-[11px] text-muted uppercase tracking-wider font-medium">or</span>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        {/* Sign in with Email */}
        <button
          type="button"
          onClick={() => {
            onClose()
            const returnToUrl = `${window.location.pathname}${window.location.search}`
            navigate(`/login?returnTo=${encodeURIComponent(returnToUrl)}`)
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border border-hairline bg-white hover:bg-surface-soft transition-colors cursor-pointer text-sm text-ink/80"
        >
          <Mail className="w-4 h-4" />
          Sign in with Email
        </button>

        <p className="text-[11px] text-muted/60 mt-5 leading-relaxed">
          By signing in, you agree to our{" "}
          <span className="font-medium" style={{ color: PRIMARY }}>Terms of Service</span>
          {" "}and{" "}
          <span className="font-medium" style={{ color: PRIMARY }}>Privacy Policy</span>
        </p>
      </div>
    </div>
  )
}
