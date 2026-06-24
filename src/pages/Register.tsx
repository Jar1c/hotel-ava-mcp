import { useState } from "react"
import { Link } from "react-router-dom"
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Register() {
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Register:", { name, email, password })
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-base py-section">
      <div className="w-full max-w-md">
        <div className="bg-canvas rounded-lg border border-hairline shadow-dropdown p-xl">
          <div className="text-center mb-xl">
            <Link to="/" className="typo-display-lg text-secondary">
              Hotel Ava
            </Link>
            <h1 className="typo-display-xl text-ink mt-md mb-sm">Create Account</h1>
            <p className="typo-body-sm text-muted">Join us for exclusive offers and rewards</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-md">
            <div>
              <label className="typo-caption text-muted block mb-xs">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-3 py-2 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink placeholder:text-muted-soft focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="typo-caption text-muted block mb-xs">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-3 py-2 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink placeholder:text-muted-soft focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                  placeholder="Create a password"
                  className="w-full pl-10 pr-10 py-2 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink placeholder:text-muted-soft focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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

            <div>
              <label className="typo-caption text-muted block mb-xs">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full pl-10 pr-3 py-2 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink placeholder:text-muted-soft focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 rounded border-hairline" />
              <span className="typo-caption-sm text-muted">
                I agree to the{" "}
                <a href="#" className="text-primary hover:text-primary-active">Terms of Service</a>
                {" "}and{" "}
                <a href="#" className="text-primary hover:text-primary-active">Privacy Policy</a>
              </span>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-on-primary hover:bg-primary-active"
            >
              Create Account
            </Button>
          </form>

          <div className="flex items-center gap-3 my-lg">
            <div className="flex-1 h-px bg-hairline" />
            <span className="typo-caption-sm text-muted">or</span>
            <div className="flex-1 h-px bg-hairline" />
          </div>

          <Button variant="outline" className="w-full">
            <User className="h-4 w-4 mr-2" />
            Continue as Guest
          </Button>

          <p className="text-center mt-lg typo-body-sm text-muted">
            Already have an account?{" "}
            <a
              href="/login"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-active font-medium"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}