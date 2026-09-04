import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import LoadingDots from "@/components/LoadingDots"
import hotelLogo from "@/assets/images/Hotel Ava logo.png"

const PRIMARY = "#82285f"

export default function ResetPassword() {
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [tokenValid, setTokenValid] = useState<boolean>(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const handleRecovery = async () => {
      const url = new URL(window.location.href)
      const code = url.searchParams.get("code")

      if (code) {
        // PKCE flow — exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          setTokenValid(true)
        }
        // Clean up the URL
        window.history.replaceState({}, "", window.location.pathname)
      } else {
        // Fallback: check if a session already exists
        const { data: { session } } = await supabase.auth.getSession()
        if (session) setTokenValid(true)
      }
      setChecking(false)
    }

    handleRecovery()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
          setTokenValid(true)
          setChecking(false)
        }
      }
    )

    const timer = setTimeout(() => setChecking(false), 3000)

    return () => {
      authListener.subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!tokenValid) {
      setError("Invalid or expired reset link.")
      return
    }
    if (!newPassword) {
      setError("Please enter a new password.")
      return
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError("Password must contain an uppercase letter.")
      return
    }
    if (!/[0-9]/.test(newPassword)) {
      setError("Password must contain a number.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setSubmitting(true)
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) throw updateError
      console.log("Password updated:", data)
      setSuccess(true)
    } catch (err) {
      console.error("Reset password error:", err)
      setError("Failed to reset password. The link may have expired.")
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    borderColor: focused === field ? PRIMARY : "#E5E1DA",
    boxShadow: focused === field ? "0 0 0 3px rgba(130,40,95,0.08)" : "none",
  })

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-[448px] text-center">
          <div className="bg-white rounded-[16px] p-8 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-[#E8F0EB] flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="size-7 text-[#3D6B4F]" />
            </div>
            <h1 className="font-display text-xl font-bold text-ink mb-2">Password Reset!</h1>
            <p className="text-sm text-muted mb-6 leading-relaxed">
              Your password has been updated. You can now sign in with your new password.
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="w-full !rounded-[10px] font-medium"
              style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
            >
              Sign In
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
        <div className="flex flex-col items-center gap-3">
          <LoadingDots size="lg" className="text-primary" />
          <p className="text-sm text-muted">Verifying reset link...</p>
        </div>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-[448px] text-center">
          <div className="bg-white rounded-[16px] p-8 shadow-sm">
            <h1 className="font-display text-xl font-bold text-error mb-2">Invalid or Expired Link</h1>
            <p className="text-sm text-muted mb-6 leading-relaxed">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button
              onClick={() => navigate("/forgot-password")}
              className="w-full !rounded-[10px] font-medium"
              style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
            >
              Request New Link
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[448px]">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={hotelLogo} alt="Hotel Ava" className="h-14 w-auto" />
        </div>

        <h1 className="typo-display-xl text-ink mb-1.5 text-center tracking-tight">
          Reset Password
        </h1>
        <p className="text-sm text-muted mb-8 text-center">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                className="w-full pl-10 pr-11 py-2.5 rounded-[10px] border typo-body-sm text-ink placeholder:text-muted-soft bg-white transition-all duration-150 focus:outline-none"
                style={inputStyle("password")}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="flex gap-3 text-[11px] mt-1.5" style={{ color: "#7A7A70" }}>
                <span className={newPassword.length >= 8 ? "text-[#3D6B4F]" : ""}>8+ chars</span>
                <span className={/[A-Z]/.test(newPassword) ? "text-[#3D6B4F]" : ""}>Uppercase</span>
                <span className={/[0-9]/.test(newPassword) ? "text-[#3D6B4F]" : ""}>Number</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Re-enter new password"
                className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border typo-body-sm text-ink placeholder:text-muted-soft bg-white transition-all duration-150 focus:outline-none"
                style={inputStyle("confirm")}
                onFocus={() => setFocused("confirm")}
                onBlur={() => setFocused(null)}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-[#A4423A] text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={submitting || !tokenValid}
            className="w-full py-2.5 font-medium !rounded-[10px] transition-all duration-200 hover:opacity-90 active:scale-[0.985] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <LoadingDots size="sm" />
                Resetting...
              </span>
            ) : (
              <>
                Reset Password
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
