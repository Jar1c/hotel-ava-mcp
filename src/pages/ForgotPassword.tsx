import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { Mail, ArrowRight, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import LoadingDots from "@/components/LoadingDots"
import hotelLogo from "@/assets/images/Hotel Ava logo.png"

const PRIMARY = "#82285f"

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError("Please enter your email address.")
      return
    }
    setSubmitting(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) throw resetError
      setSuccess(true)
    } catch {
      setError("Something went wrong. Please try again.")
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
        <div className="w-full max-w-[448px]">
          <div className="bg-white rounded-[16px] p-8 shadow-sm text-center">
            <div className="w-14 h-14 rounded-full bg-[#E8F0EB] flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="size-7 text-[#3D6B4F]" />
            </div>
            <h1 className="font-display text-xl font-bold text-ink mb-2">Check Your Email</h1>
            <p className="text-sm text-muted mb-4 leading-relaxed">
              We&apos;ve sent a password reset link to <strong>{email}</strong>. Click the link in the email to reset your password.
            </p>
            <p className="text-xs text-muted mb-6 leading-relaxed">
              Didn&apos;t receive the email? Check your spam folder or try again.
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="w-full !rounded-[10px] font-medium"
              style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[448px]">
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors mb-6 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Sign In
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={hotelLogo} alt="Hotel Ava" className="h-14 w-auto" />
        </div>

        <h1 className="typo-display-xl text-ink mb-1.5 text-center tracking-tight">
          Forgot Password?
        </h1>
        <p className="text-sm text-muted mb-8 text-center">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border typo-body-sm text-ink placeholder:text-muted-soft bg-white transition-all duration-150 focus:outline-none"
                style={inputStyle("email")}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-[#A4423A] text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 font-medium !rounded-[10px] transition-all duration-200 hover:opacity-90 active:scale-[0.985] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <LoadingDots size="sm" />
                Sending...
              </span>
            ) : (
              <>
                Send Reset Link
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Remember your password?{" "}
          <Link
            to="/login"
            className="font-medium hover:underline transition-colors"
            style={{ color: PRIMARY }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
