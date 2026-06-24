import { useState } from "react"
import { Link } from "react-router-dom"
import { Mail, Lock, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Login:", { email, password })
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:block lg:w-1/2 relative">
        <img
          src="https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&h=1600&fit=crop"
          alt="Hotel"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-scrim/70 to-scrim/20" />
        <div className="absolute bottom-12 left-12 right-12">
          <h2 className="typo-display-lg text-on-primary mb-sm">Hotel Ava</h2>
          <p className="typo-body-sm text-on-primary/80 max-w-md">
            Experience luxury accommodations and world-class hospitality.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center px-lg py-xl bg-canvas">
        <div style={{ width: "100%", maxWidth: "24rem" }}>
          <Link to="/" className="block mb-xl text-center lg:text-left">
            <span className="typo-display-lg text-primary">Hotel Ava</span>
          </Link>

          <h1 className="typo-display-xl text-ink mb-sm text-center lg:text-left">Welcome back</h1>
          <p className="typo-body-sm text-muted mb-xl text-center lg:text-left">Sign in to continue to your account</p>

          <form onSubmit={handleSubmit} className="space-y-md">
            <div>
              <label className="typo-caption text-muted block mb-xs">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink placeholder:text-muted-soft focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="typo-caption text-muted block mb-xs">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink placeholder:text-muted-soft focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-hairline" />
                <span className="typo-caption-sm text-muted">Remember me</span>
              </label>
              <a href="#" className="typo-caption-sm text-primary hover:text-primary-active">
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-on-primary hover:bg-primary-active py-2.5"
            >
              Sign In
            </Button>
          </form>

          <div className="flex items-center gap-3 my-lg">
            <div className="flex-1 h-px bg-hairline" />
            <span className="typo-caption-sm text-muted">or</span>
            <div className="flex-1 h-px bg-hairline" />
          </div>

          <p className="text-center typo-body-sm text-muted">
            Don&apos;t have an account?{" "}
            <a
              href="/register"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-active font-medium"
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
