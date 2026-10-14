import { useState } from "react"
import { useNavigate } from "react-router"
import { Mail, Lock, Eye, EyeOff, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import LoadingDots from "@/components/LoadingDots"
import hotelLogo from "@/assets/images/Hotel Ava logo.png"

const PRIMARY = "#82285f"

export default function AdminLogin() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const loggedUser = await login(email, password)
      if (loggedUser?.role !== "admin") {
        setError("Access denied. This portal is for admins only.")
        await logout()
        return
      }
      navigate("/admin/dashboard")
    } catch {
      setError("Invalid credentials. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = (_field: string) =>
    `w-full pl-10 pr-4 py-2.5 rounded-[12px] border typo-body-sm text-ink placeholder:text-muted-soft bg-white transition-all duration-150 focus:outline-none`

  const inputStyle = (field: string): React.CSSProperties => ({
    borderColor: focused === field ? PRIMARY : "#DCD5C4",
    boxShadow: focused === field ? `0 0 0 3px rgba(130,40,95,0.10)` : "none",
  })

  return (
    <div className="min-h-screen flex">

      {/* LEFT: Hero Panel */}
      <div className="hidden lg:flex lg:w-3/5 relative min-h-screen flex-col overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&h=1600&fit=crop"
          alt="Hotel Ava interior lobby"
          className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
        />

        <div className="absolute inset-0 bg-gradient-to-br from-scrim/50 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-scrim/92 via-scrim/25 to-transparent" />

        {/* Top-left logo */}
        <div className="relative z-10 p-10">
          <img src={hotelLogo} alt="Hotel Ava" className="h-10 w-auto drop-shadow-lg" />
        </div>

        {/* Bottom hero copy */}
        <div className="relative z-10 mt-auto px-12 pb-14">
          <div
            className="w-14 h-[3px] mb-6 rounded-full"
            style={{ backgroundColor: PRIMARY }}
          />

          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-5 text-white text-xs font-semibold tracking-widest uppercase"
            style={{
              background: "rgba(130,40,95,0.50)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            <Shield className="w-3 h-3" />
            Admin Portal
          </div>

          <h2
            className="font-display text-white font-bold leading-[1.15] mb-5"
            style={{ fontSize: "clamp(1.9rem, 3vw, 2.65rem)" }}
          >
            Dare To Be Different<br />
            Here at Hotel Ava
          </h2>

          <p
            className="font-body text-white/72 leading-relaxed mb-9"
            style={{ fontSize: "0.975rem", maxWidth: "400px" }}
          >
            Sign in to manage bookings, monitor occupancy, and oversee Hotel Ava Malate.
          </p>

          <div className="flex items-center gap-6">
            <p className="font-body text-white/55 text-[13px]">
              Bookings, occupancy, and revenue at a glance
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT: Form Panel */}
      <div className="w-full lg:w-2/5 flex items-center justify-center px-8 py-12 bg-canvas">
        <div style={{ width: "100%", maxWidth: "26rem" }}>

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

          {/* Brand mark */}
          <div className="flex justify-center mb-7">
            <img src={hotelLogo} alt="Hotel Ava" className="h-14 w-auto" />
          </div>

          <h1 className="typo-display-xl text-ink mb-2 text-center">
            Admin Portal
          </h1>
          <p className="typo-body-sm text-muted mb-7 text-center">
            Sign in to access the management dashboard
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label htmlFor="email" className="typo-caption text-muted block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  spellCheck={false}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hotelava.com"
                  className={inputClass("email")}
                  style={inputStyle("email")}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="typo-caption text-muted block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className={`${inputClass("password")} pr-11`}
                  style={inputStyle("password")}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full py-3 font-semibold !rounded-[12px] transition-all duration-200 hover:opacity-90 active:scale-[0.985] shadow-md disabled:opacity-50"
                style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingDots size="sm" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In to Admin"
                )}
              </Button>
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-sm text-error text-center">{error}</p>
            )}
          </form>

          <p className="text-center typo-body-sm text-muted mt-6">
            <a
              href="/"
              className="font-semibold hover:underline transition-colors"
              style={{ color: PRIMARY }}
            >
              Back to Hotel Ava
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
