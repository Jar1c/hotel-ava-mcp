import { useEffect, useState } from "react"
import { Link, useSearchParams, useNavigate } from "react-router"
import { CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import LoadingDots from "@/components/LoadingDots"
import hotelLogo from "@/assets/images/Hotel Ava logo.png"

type VerifyState = "loading" | "success" | "redirecting" | "expired"

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState<VerifyState>("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    const token = searchParams.get("token")
    const email = searchParams.get("email")

    if (!token || !email) {
      setState("expired")
      setError("Invalid verification link")
      return
    }

    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
    fetch(`${apiBase}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email, type: "signup" }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (res.ok) {
          // If backend returned tokens, auto-login
          if (data.access_token && data.refresh_token) {
            localStorage.setItem("access_token", data.access_token)
            localStorage.setItem("refresh_token", data.refresh_token)
            setState("redirecting")
            setTimeout(() => navigate("/"), 2500)
          } else {
            setState("success")
          }
        } else {
          // Token already used = email is already verified, treat as success
          if (data.error && (data.error.includes("already") || data.error.includes("expired") || data.error.includes("invalid"))) {
            setState("success")
          } else {
            setState("expired")
            setError(data.error || "Verification failed or link expired")
          }
        }
      })
      .catch(() => {
        setState("expired")
        setError("Network error. Please try again.")
      })
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6F8] px-4">
      <div className="w-full max-w-[400px] text-center">
        <Link to="/" className="inline-block mb-8">
          <img src={hotelLogo} alt="Hotel Ava" className="h-14 w-auto mx-auto" />
        </Link>

        <div className="bg-white rounded-[12px] border border-[#D5DADF] shadow-sm p-8">
          {state === "loading" && (
            <>
              <div className="mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full bg-[#F4F6F8]">
                <LoadingDots size="lg" className="text-primary" />
              </div>
              <h1 className="text-lg font-bold text-[#2A2A28] mb-2">Verifying your email...</h1>
              <p className="text-sm text-[#7A7A70]">Please wait while we confirm your address.</p>
            </>
          )}

          {state === "success" && (
            <>
              <div className="mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full bg-[#3D6B4F]/10">
                <CheckCircle className="size-7 text-[#3D6B4F]" />
              </div>
              <h1 className="text-lg font-bold text-[#2A2A28] mb-2">You're all verified!</h1>
              <p className="text-sm text-[#7A7A70] mb-6">
                Your email has been confirmed. You can now sign in to your account and start booking.
              </p>
              <Link to="/login">
                <Button className="w-full bg-[#82285f] hover:bg-[#6b1f4b] text-white text-sm rounded-[6px] py-2.5">
                  Sign In to Your Account
                </Button>
              </Link>
            </>
          )}

          {state === "redirecting" && (
            <>
              <div className="mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full bg-[#3D6B4F]/10">
                <CheckCircle className="size-7 text-[#3D6B4F]" />
              </div>
              <h1 className="text-lg font-bold text-[#2A2A28] mb-2">Email verified!</h1>
              <p className="text-sm text-[#7A7A70] mb-5">
                Your account is ready. Redirecting you to the main page...
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-[#82285f]">
                <LoadingDots size="sm" className="text-primary" />
                <span className="font-medium">Redirecting...</span>
              </div>
            </>
          )}

          {state === "expired" && (
            <>
              <div className="mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full bg-[#A4423A]/10">
                <XCircle className="size-7 text-[#A4423A]" />
              </div>
              <h1 className="text-lg font-bold text-[#2A2A28] mb-2">Link expired or already used</h1>
              <p className="text-sm text-[#7A7A70] mb-6">
                {error || "This verification link is no longer valid. Please sign in to request a new verification email."}
              </p>
              <Link to="/login">
                <Button className="w-full bg-[#82285f] hover:bg-[#6b1f4b] text-white text-sm rounded-[6px] py-2.5">
                  Go to Sign In
                </Button>
              </Link>
            </>
          )}
        </div>

        <Link to="/" className="inline-block mt-6 text-xs text-[#7A7A70] hover:text-[#82285f] transition-colors">
          ← Back to Hotel Ava
        </Link>
      </div>
    </div>
  )
}
