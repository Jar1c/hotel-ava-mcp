import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import hotelLogo from "@/assets/images/Hotel Ava logo.png"

export default function CopyCode() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get("c") || ""
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setFailed(false)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6F8] px-4">
      <div className="w-full max-w-[400px] text-center">
        <Link to="/" className="inline-block mb-8">
          <img src={hotelLogo} alt="Hotel Ava" className="h-14 w-auto mx-auto" />
        </Link>

        <div className="bg-white rounded-[12px] border border-hairline shadow-sm p-8">
          {code ? (
            <>
              <h1 className="text-lg font-bold text-[#2A2A28] mb-2">Your verification code</h1>
              <p className="text-sm text-[#7A7A70] mb-5">
                Copy it below, then paste it into the verification box on the sign-in page.
              </p>

              <div className="bg-canvas border border-hairline rounded-[12px] px-4 py-4 mb-4">
                <span className="font-mono text-[26px] font-bold tracking-[0.3em] text-primary select-all block text-center">
                  {code}
                </span>
              </div>

              <Button
                type="button"
                onClick={() => void handleCopy()}
                className={cn(
                  "w-full h-11 rounded-[12px] text-sm",
                  copied ? "bg-[#3D6B4F] hover:bg-[#3D6B4F]" : "bg-primary hover:bg-primary/80"
                )}
              >
                {copied ? (
                  <>
                    <Check /> Copied!
                  </>
                ) : (
                  <>
                    <Copy /> Copy code
                  </>
                )}
              </Button>

              {failed && (
                <p className="mt-3 text-xs text-[#A4423A]">
                  Copy blocked by the browser. Select the code above and press Ctrl+C.
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold text-[#2A2A28] mb-2">No code provided</h1>
              <p className="text-sm text-[#7A7A70] mb-6">
                This page needs the code from your verification email. Request a new one on the sign-in page.
              </p>
              <Link to="/login">
                <Button className="w-full h-11 rounded-[12px] text-sm bg-primary hover:bg-primary/80">
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
