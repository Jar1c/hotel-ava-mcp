import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router"
import { CheckCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const PRIMARY = "#82285f"

export default function BookingConfirmation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || id === "success") {
      setLoading(false)
      return
    }

    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
    const token = localStorage.getItem("access_token")
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    // First confirm the booking (handles PayMongo redirect)
    fetch(`${apiBase}/bookings/confirm/${id}`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
    })
      .then(() => {
        // Then fetch full booking details
        return fetch(`${apiBase}/bookings/${id}`, { headers: authHeaders })
      })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch booking")
        return res.json()
      })
      .then((data) => setBooking(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="px-base py-section animate-pulse">
        <div className="max-w-[640px] mx-auto text-center">
          <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-lg" />
          <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-md" />
          <div className="h-4 bg-gray-200 rounded w-96 mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-base py-section">
      <div className="max-w-[640px] mx-auto text-center">
        {/* Animated Checkmark */}
        <div className="mb-lg relative inline-flex">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "#E8F5E9" }}
          >
            <CheckCircle
              className="h-14 w-14"
              style={{ color: "#3D6B4F" }}
              strokeWidth={1.5}
            />
          </div>
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ backgroundColor: "#3D6B4F" }}
          />
        </div>

        <h1 className="typo-display-xl text-ink mb-sm">Booking Confirmed!</h1>
        <p className="typo-body-lg text-muted mb-lg">
          Your reservation at Hotel Ava has been confirmed.
          <br />
          A confirmation email has been sent to your inbox.
        </p>

        {booking && (
          <div className="bg-white border border-hairline rounded-[12px] p-lg mb-lg text-left">
            <h2 className="typo-display-sm text-ink mb-md">Booking Details</h2>
            <div className="space-y-sm">
              <div className="flex justify-between typo-body-sm">
                <span className="text-muted">Booking ID</span>
                <span className="text-ink font-medium font-mono">
                  {id === "success" ? "N/A" : `#${id?.slice(0, 8).toUpperCase()}`}
                </span>
              </div>
              {booking.room_name && (
                <div className="flex justify-between typo-body-sm">
                  <span className="text-muted">Room</span>
                  <span className="text-ink">{booking.room_name}</span>
                </div>
              )}
              {booking.check_in && (
                <div className="flex justify-between typo-body-sm">
                  <span className="text-muted">Check-in</span>
                  <span className="text-ink">
                    {new Date(booking.check_in).toLocaleDateString("en-US", {
                      month: "2-digit", day: "2-digit", year: "2-digit",
                    })}
                  </span>
                </div>
              )}
              {booking.check_out && (
                <div className="flex justify-between typo-body-sm">
                  <span className="text-muted">Check-out</span>
                  <span className="text-ink">
                    {new Date(booking.check_out).toLocaleDateString("en-US", {
                      month: "2-digit", day: "2-digit", year: "2-digit",
                    })}
                  </span>
                </div>
              )}
              {booking.total_price && (
                <div className="flex justify-between font-semibold pt-sm border-t border-hairline">
                  <span className="typo-body-md text-ink">Total Paid</span>
                  <span className="typo-body-md" style={{ color: PRIMARY }}>
                    ₱{booking.total_price.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-sm justify-center">
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
            Browse More Rooms
          </Button>
        </div>
      </div>
    </div>
  )
}
