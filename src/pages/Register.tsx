import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Mail, Lock, User, Eye, EyeOff, CheckCircle2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import PasswordStrength from "@/components/PasswordStrength"
import { useAuth } from "@/contexts/AuthContext"
import hotelLogo from "@/assets/images/Hotel Ava logo.png"

const PRIMARY = "#82285f"

function SubmitButton({ disabled, submitting }: { disabled: boolean; submitting: boolean }) {
  return (
    <Button
      type="submit"
      disabled={disabled || submitting}
      className="w-full py-2.5 font-medium !rounded-[10px] transition-all duration-200 hover:opacity-90 active:scale-[0.985] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
    >
      {submitting ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Creating account...
        </span>
      ) : (
        <>
          Create Account
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </Button>
  )
}

export default function Register() {
  const { register, login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get("returnTo") || "/"

  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const passwordValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)
  const canSubmit = agreedToTerms && passwordValid && name.trim() && email.trim() && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!canSubmit) return

    setSubmitting(true)
    try {
      await register(email, password, name)
      setRegisteredEmail(email)
    } catch (err: unknown) {
      let message = "Unable to create account. Please try again."
      if (err instanceof Error) {
        message = err.message
      } else if (typeof err === "string") {
        message = err
      } else if (err && typeof err === "object" && "message" in err) {
        message = String((err as { message: unknown }).message)
      }
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = (_field: string) =>
    `w-full pl-10 pr-4 py-2.5 rounded-[10px] border typo-body-sm text-ink placeholder:text-muted-soft bg-white transition-all duration-150 focus:outline-none`

  const inputStyle = (field: string): React.CSSProperties => ({
    borderColor: focused === field ? PRIMARY : "#E5E1DA",
    boxShadow: focused === field ? `0 0 0 3px rgba(130,40,95,0.08)` : "none",
  })

  return (
    <div className="min-h-screen flex">

      {/* ══ LEFT: Hero Panel ══ */}
      <div className="hidden lg:flex lg:w-3/5 relative min-h-screen flex-col overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&h=1600&fit=crop"
          alt="Hotel Ava exterior"
          className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
        />

        {/* Gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-scrim/50 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-scrim/92 via-scrim/25 to-transparent" />

        {/* Top-left logo */}
        <div className="relative z-10 p-10">
          <img src={hotelLogo} alt="Hotel Ava" className="h-10 w-auto brightness-0 invert" />
        </div>

        {/* Bottom hero copy */}
        <div className="relative z-10 mt-auto px-12 pb-14">
          <div
            className="w-10 h-[2px] mb-5"
            style={{ backgroundColor: PRIMARY }}
          />

          <h2
            className="font-display text-white font-bold leading-[1.15] mb-4"
            style={{ fontSize: "clamp(1.75rem, 2.8vw, 2.4rem)" }}
          >
            Every Stay<br />
            Starts with Comfort
          </h2>

          <p
            className="font-body text-white/65 leading-relaxed mb-8"
            style={{ fontSize: "0.9rem", maxWidth: "380px" }}
          >
            Join Hotel Ava Malate and unlock exclusive rates and seamless booking.
          </p>

          <div className="flex items-center gap-6">
            {[
              { value: "12 Hrs", label: "Prime Stay" },
              { value: "24 Hrs", label: "Full Day" },
              { value: "Private", label: "Garage" },
            ].map(({ value, label }) => (
              <div key={label} className="border-l border-white/20 pl-4 first:border-0 first:pl-0">
                <p className="text-white font-semibold text-sm leading-tight">{value}</p>
                <p className="text-white/45 text-[11px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ RIGHT: Form Panel ══ */}
      <div className="w-full lg:w-2/5 flex items-center justify-center px-8 py-12 bg-canvas">
        <div style={{ width: "100%", maxWidth: "24rem" }}>

          {/* Back Button */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors mb-6 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>

          {registeredEmail ? (
            /* ══ Email Verification Success Screen ══ */
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E8F0EB" }}>
                  <CheckCircle2 className="w-7 h-7" style={{ color: "#3D6B4F" }} />
                </div>
              </div>
              <h1 className="typo-display-xl text-ink mb-2 tracking-tight">Check your email</h1>
              <p className="text-sm text-muted mb-1">
                We sent a verification link to
              </p>
              <p className="text-sm font-semibold text-ink mb-5">{registeredEmail}</p>
              <p className="text-xs text-muted mb-7">
                Click the link to verify your account. Check spam if you don't see it.
              </p>
              <Button
                onClick={() => navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)}
                className="w-full py-2.5 font-medium !rounded-[10px] flex items-center justify-center gap-2"
                style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
              >
                Go to Login
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
          <>
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={hotelLogo} alt="Hotel Ava" className="h-14 w-auto" />
          </div>

          <h1 className="typo-display-xl text-ink mb-1.5 text-center tracking-tight">
            Create your Account
          </h1>
          <p className="text-sm text-muted mb-7 text-center">
            Join Hotel Ava for exclusive offers
          </p>

          {/* Google SSO */}
          <button
            type="button"
            onClick={async () => {
              await login("user@gmail.com", "mock-password")
              navigate("/")
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-[10px] border border-hairline bg-white hover:bg-surface-soft transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-sm text-ink/80">Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-hairline" />
            <span className="text-[11px] text-muted uppercase tracking-wider font-medium">or</span>
            <div className="flex-1 h-px bg-hairline" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Full Name */}
            <div>
              <label className="text-xs font-medium text-muted block mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <input
                  type="text"
                  name="name"
                  placeholder="Juan Dela Cruz"
                  className={inputClass("name")}
                  style={inputStyle("name")}
                  onFocus={() => setFocused("name")}
                  onBlur={() => setFocused(null)}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-xs font-medium text-muted block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  className={inputClass("email")}
                  style={inputStyle("email")}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-muted block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Min. 8 characters"
                  className={`${inputClass("password")} pr-11`}
                  style={inputStyle("password")}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            {/* Terms */}
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                name="terms"
                id="terms"
                className="mt-0.5 w-3.5 h-3.5 rounded border cursor-pointer"
                style={{ accentColor: PRIMARY }}
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <label htmlFor="terms" className="text-xs text-muted cursor-pointer leading-relaxed">
                I agree to the{" "}
                <a href="#" className="font-medium hover:underline" style={{ color: PRIMARY }}>
                  Terms
                </a>
                {" "}and{" "}
                <a href="#" className="font-medium hover:underline" style={{ color: PRIMARY }}>
                  Privacy Policy
                </a>
              </label>
            </div>

            {/* CTA Button */}
            <SubmitButton disabled={!canSubmit} submitting={submitting} />

            {/* Error Message */}
            {error && (
              <p className="text-sm text-error text-center">{error}</p>
            )}
          </form>

          <p className="text-center text-sm text-muted mt-6">
            Already have an account?{" "}
            <Link
              to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
              className="font-medium hover:underline transition-colors"
              style={{ color: PRIMARY }}
            >
              Sign in
            </Link>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
