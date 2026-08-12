import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { authApi } from "@/services/api"
import hotelLogo from "@/assets/images/Hotel Ava logo.png"

const PRIMARY = "#82285f"

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const accessToken = searchParams.get("access_token") || ""
  const refreshToken = searchParams.get("refresh_token") || ""

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !refreshToken) {
      setError("Invalid or expired reset link. Please request a new one.")
    }
  }, [accessToken, refreshToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!accessToken || !refreshToken) {
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
      await authApi.resetPassword({
        access_token: accessToken,
        refresh_token: refreshToken,
        new_password: newPassword,
      })
      setSuccess(true)
    } catch {
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
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-[12px] p-8 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-[#E8F0EB] flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="size-7 text-[#3D6B4F]" />
            </div>
            <h1 className="font-display text-xl font-bold text-ink mb-2">Password Reset!</h1>
            <p className="text-sm text-muted mb-6">
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div style={{ width: "100%", maxWidth: "24rem" }}>
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
            disabled={submitting || !accessToken || !refreshToken}
            className="w-full py-2.5 font-medium !rounded-[10px] transition-all duration-200 hover:opacity-90 active:scale-[0.985] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
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
