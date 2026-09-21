import { useState } from "react"
import { useNavigate } from "react-router"
import { User, ArrowRight, ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import LoadingDots from "@/components/LoadingDots"
import hotelLogo from "@/assets/images/Hotel Ava logo.png"

const PRIMARY = "#82285f"

type Step = "terms" | "name"

export default function CompleteRegistration() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()

  // Split Google name into first/last if available
  const googleName = user?.name || ""
  const parts = googleName.includes("@") ? [] : googleName.split(" ")

  const [step, setStep] = useState<Step>("terms")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [firstName, setFirstName] = useState(parts[0] || "")
  const [lastName, setLastName] = useState(parts.slice(1).join(" ") || "")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const firstNameValid = firstName.trim().length > 0 && !/[^a-zA-Z\s]/.test(firstName)
  const lastNameValid = lastName.trim().length > 0 && !/[^a-zA-Z\s]/.test(lastName)
  const canSubmit = firstNameValid && lastNameValid && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError("")
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
      const token = sessionStorage.getItem("access_token")

      const res = await fetch(`${apiBase}/auth/complete-registration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: fullName }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update name")
      }

      updateUser({ name: fullName })
      navigate("/")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const formatName = (value: string) => {
    if (!value) return value
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Hero */}
      <div className="hidden lg:flex lg:w-3/5 relative min-h-screen flex-col overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&h=1600&fit=crop"
          alt="Hotel Ava"
          className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-scrim/50 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-scrim/92 via-scrim/25 to-transparent" />
        <div className="relative z-10 p-10">
          <img src={hotelLogo} alt="Hotel Ava" className="h-10 w-auto brightness-0 invert" />
        </div>
        <div className="relative z-10 mt-auto px-12 pb-14">
          <div className="w-10 h-[2px] mb-5" style={{ backgroundColor: PRIMARY }} />
          <h2 className="font-display text-white font-bold leading-[1.15] mb-4" style={{ fontSize: "clamp(1.75rem, 2.8vw, 2.4rem)" }}>
            Complete Your<br />Profile
          </h2>
          <p className="font-body text-white/65 leading-relaxed" style={{ fontSize: "0.9rem", maxWidth: "380px" }}>
            Just one more step to start booking at Hotel Ava.
          </p>
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center px-8 py-12 bg-canvas">
        <div style={{ width: "100%", maxWidth: "24rem" }}>
          {/* Logo (mobile) */}
          <div className="flex justify-center mb-8 lg:hidden">
            <img src={hotelLogo} alt="Hotel Ava" className="h-14 w-auto" />
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step === "terms" ? "text-white" : "bg-[#3D6B4F]/10 text-[#3D6B4F]"}`} style={step === "terms" ? { backgroundColor: PRIMARY } : {}}>
              {step === "terms" ? "1" : <Check className="w-4 h-4" />}
            </div>
            <div className={`flex-1 h-0.5 ${step === "name" ? "bg-[#3D6B4F]" : "bg-[#E5E1DA]"}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step === "name" ? "text-white" : "bg-[#E5E1DA] text-[#9ca3af]"}`} style={step === "name" ? { backgroundColor: PRIMARY } : {}}>
              2
            </div>
          </div>

          {/* Step 1: Terms & Privacy */}
          {step === "terms" && (
            <div>
              <h1 className="typo-display-xl text-ink mb-1.5 text-center tracking-tight">
                Terms & Privacy
              </h1>
              <p className="text-sm text-muted mb-6 text-center">
                Please review and accept our terms before continuing.
              </p>

              <div className="bg-white border border-[#E5E1DA] rounded-[12px] p-5 mb-5 max-h-[300px] overflow-y-auto text-sm text-[#4a4f59] leading-relaxed space-y-4">
                <div>
                  <h3 className="font-semibold text-ink mb-1">Terms of Service</h3>
                  <p>By using Hotel Ava's booking system, you agree to our terms of service. This includes making reservations in good faith, providing accurate information, and complying with hotel policies regarding check-in/check-out times, cancellations, and guest conduct.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-ink mb-1">Privacy Policy</h3>
                  <p>We collect personal information such as your name, email, and booking details to provide our services. Your data is stored securely and is only used for reservation management, communication, and improving your experience. We do not sell your personal information to third parties.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-ink mb-1">Cancellation Policy</h3>
                  <p>Free cancellation is available up to 24 hours before your scheduled check-in. Late cancellations or no-shows may incur charges based on the total booking amount.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 mb-6">
                <input
                  type="checkbox"
                  id="terms"
                  className="mt-0.5 w-4 h-4 rounded border cursor-pointer"
                  style={{ accentColor: PRIMARY }}
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <label htmlFor="terms" className="text-sm text-muted cursor-pointer leading-relaxed">
                  I have read and agree to the{" "}
                  <span className="font-medium" style={{ color: PRIMARY }}>Terms of Service</span>
                  {" "}and{" "}
                  <span className="font-medium" style={{ color: PRIMARY }}>Privacy Policy</span>
                </label>
              </div>

              <Button
                onClick={() => {
                  if (agreedToTerms) setStep("name")
                }}
                disabled={!agreedToTerms}
                className="w-full py-2.5 font-medium !rounded-[10px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Name */}
          {step === "name" && (
            <div>
              <h1 className="typo-display-xl text-ink mb-1.5 text-center tracking-tight">
                What's your name?
              </h1>
              <p className="text-sm text-muted mb-6 text-center">
                Tell us how to address you at Hotel Ava.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1.5">First Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Juan"
                        value={firstName}
                        onChange={(e) => setFirstName(formatName(e.target.value))}
                        maxLength={50}
                        className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border border-[#E5E1DA] typo-body-sm text-ink placeholder:text-muted-soft bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#82285f]/20 focus:border-[#82285f]/40"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1.5">Last Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Dela Cruz"
                        value={lastName}
                        onChange={(e) => setLastName(formatName(e.target.value))}
                        maxLength={50}
                        className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border border-[#E5E1DA] typo-body-sm text-ink placeholder:text-muted-soft bg-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#82285f]/20 focus:border-[#82285f]/40"
                      />
                    </div>
                  </div>
                </div>

                {(firstName && /[^a-zA-Z\s]/.test(firstName)) && (
                  <p className="text-xs text-[#A4423A]">Letters and spaces only — no numbers or special characters</p>
                )}
                {(lastName && /[^a-zA-Z\s]/.test(lastName)) && (
                  <p className="text-xs text-[#A4423A]">Letters and spaces only — no numbers or special characters</p>
                )}

                {error && (
                  <p className="text-sm text-[#A4423A] text-center">{error}</p>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => setStep("terms")}
                    variant="outline"
                    className="!rounded-[10px] px-4"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="flex-1 py-2.5 font-medium !rounded-[10px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <LoadingDots size="sm" />
                        Setting up...
                      </span>
                    ) : (
                      <>
                        Complete Registration
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
