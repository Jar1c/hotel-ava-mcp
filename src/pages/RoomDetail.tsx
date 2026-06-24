import { useParams, Link } from "react-router-dom"
import { Star, Users, ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getRoomById, getAmenityIcon } from "@/data/rooms"
import PhotoGallery from "@/components/rooms/PhotoGallery"

export default function RoomDetail() {
  const { id } = useParams<{ id: string }>()
  const room = getRoomById(id || "")

  if (!room) {
    return (
      <div className="px-base py-section text-center">
        <h1 className="typo-display-xl text-ink mb-md">Room Not Found</h1>
        <p className="typo-body-md text-muted mb-lg">
          The room you're looking for doesn't exist.
        </p>
        <Link to="/rooms">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Rooms
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="px-base py-section">
      <div className="max-w-container mx-auto">
        <Link
          to="/rooms"
          className="inline-flex items-center gap-2 text-muted hover:text-ink transition-colors mb-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="typo-body-sm">Back to Rooms</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div className="lg:col-span-2">
            <PhotoGallery images={room.images} alt={room.name} />

            <div className="mt-lg">
              <div className="flex items-start justify-between mb-md">
                <div>
                  <h1 className="typo-display-lg text-ink">{room.name}</h1>
                  <p className="typo-body-sm text-muted">{room.type}</p>
                </div>
                <div className="flex items-center gap-2 bg-surface-soft px-3 py-1 rounded-full">
                  <Star className="h-4 w-4 fill-star-rating text-star-rating" />
                  <span className="typo-title-sm text-ink">{room.rating}</span>
                  <span className="typo-caption-sm text-muted">({room.reviews} reviews)</span>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-lg text-muted">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span className="typo-body-sm">Up to {room.capacity} guests</span>
                </div>
              </div>

              <div className="border-t border-hairline pt-lg">
                <h2 className="typo-display-sm text-ink mb-md">About this room</h2>
                <p className="typo-body-md text-body leading-relaxed">{room.description}</p>
              </div>

              <div className="border-t border-hairline pt-lg mt-lg">
                <h2 className="typo-display-sm text-ink mb-md">Amenities</h2>
                <div className="grid grid-cols-2 gap-sm">
                  {room.amenities.map((amenity) => (
                    <div
                      key={amenity}
                      className="flex items-center gap-2 py-2"
                    >
                      <span className="text-lg">{getAmenityIcon(amenity)}</span>
                      <span className="typo-body-sm text-ink">{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-canvas border border-hairline rounded-lg p-lg">
              <div className="mb-lg">
                <div className="flex items-baseline gap-1">
                  <span className="typo-display-lg text-secondary">${room.price}</span>
                  <span className="typo-body-sm text-muted">/ night</span>
                </div>
              </div>

              <div className="space-y-md mb-lg">
                <div>
                  <label className="typo-caption text-muted block mb-xs">Check-in</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="typo-caption text-muted block mb-xs">Check-out</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="typo-caption text-muted block mb-xs">Guests</label>
                  <select className="w-full px-3 py-2 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                    {Array.from({ length: room.capacity }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "Guest" : "Guests"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button className="w-full bg-primary text-on-primary hover:bg-primary-active">
                Reserve Now
              </Button>

              <div className="mt-lg pt-lg border-t border-hairline">
                <div className="flex justify-between mb-sm">
                  <span className="typo-body-sm text-muted">Per night</span>
                  <span className="typo-body-sm text-ink">${room.price}</span>
                </div>
                <div className="flex justify-between mb-sm">
                  <span className="typo-body-sm text-muted">Taxes & fees</span>
                  <span className="typo-body-sm text-ink">${Math.round(room.price * 0.12)}</span>
                </div>
                <div className="flex justify-between font-medium pt-sm border-t border-hairline">
                  <span className="typo-body-md text-ink">Total</span>
                  <span className="typo-body-md text-ink">
                    ${room.price + Math.round(room.price * 0.12)}
                  </span>
                </div>
              </div>

              <div className="mt-lg">
                <h3 className="typo-caption text-muted mb-sm">Highlights</h3>
                <ul className="space-y-sm">
                  <li className="flex items-center gap-2 text-sm text-ink">
                    <Check className="h-4 w-4 text-success" />
                    Free cancellation up to 24 hours before check-in
                  </li>
                  <li className="flex items-center gap-2 text-sm text-ink">
                    <Check className="h-4 w-4 text-success" />
                    No prepayment needed
                  </li>
                  <li className="flex items-center gap-2 text-sm text-ink">
                    <Check className="h-4 w-4 text-success" />
                    Pay at the property
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
