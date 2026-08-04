import { useNavigate, useSearchParams } from "react-router"
import { XCircle, ArrowRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

const PRIMARY = "#82285f"

export default function PaymentFailed() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const bookingId = searchParams.get("booking")

  return (
    <div className="px-base py-section">
      <div className="max-w-[640px] mx-auto text-center">
        {/* Animated X */}
        <div className="mb-lg relative inline-flex">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#FEE2E2" }}
          >
            <XCircle
              className="h-14 w-14"
              style={{ color: "#A4423A" }}
              strokeWidth={1.5}
            />
          </div>
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ color: "#A4423A" }}
          />
        </div>

        <h1 className="typo-display-xl text-ink mb-sm">Payment Failed</h1>
        <p className="typo-body-lg text-muted mb-lg">
          Something went wrong with your payment.
          <br />
          Don't worry, you haven't been charged. You can try again.
        </p>

        <div className="flex flex-col sm:flex-row gap-sm justify-center">
          {bookingId && (
            <Button
              onClick={() => navigate("/my-bookings")}
              className="!rounded-[12px] px-lg"
              style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Payment
            </Button>
          )}
          <Button
            onClick={() => navigate("/")}
            className="!rounded-[12px] px-lg"
            style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
          >
            Back to Home
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/rooms")}
            className="!rounded-[12px] px-lg"
          >
            Browse Rooms
          </Button>
        </div>
      </div>
    </div>
  )
}
