import { Link } from "react-router-dom"
import { Star, Users } from "lucide-react"
import type { Room } from "@/data/rooms"
import { getAmenityIcon } from "@/data/rooms"

interface RoomCardProps {
  room: Room
}

export default function RoomCard({ room }: RoomCardProps) {
  return (
    <Link
      to={`/rooms/${room.id}`}
      className="group block bg-canvas rounded-lg border border-hairline overflow-hidden hover:shadow-card-hover transition-all duration-200"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={room.images[0]}
          alt={room.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {room.featured && (
          <span className="absolute top-3 left-3 bg-primary text-on-primary typo-badge px-2 py-1 rounded-full">
            Featured
          </span>
        )}
        <div className="absolute bottom-3 right-3 bg-canvas/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
          <Star className="h-3 w-3 fill-star-rating text-star-rating" />
          <span className="typo-caption-sm text-ink">{room.rating}</span>
          <span className="typo-caption-sm text-muted">({room.reviews})</span>
        </div>
      </div>

      <div className="p-base">
        <div className="flex items-start justify-between mb-xs">
          <div>
            <h3 className="typo-title-md text-ink group-hover:text-primary transition-colors">
              {room.name}
            </h3>
            <p className="typo-caption-sm text-muted">{room.type}</p>
          </div>
          <div className="flex items-center gap-1 text-muted">
            <Users className="h-4 w-4" />
            <span className="typo-caption-sm">{room.capacity}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-sm">
          {room.amenities.slice(0, 4).map((amenity) => (
            <span
              key={amenity}
              className="inline-flex items-center gap-1 text-xs bg-surface-soft text-body px-2 py-0.5 rounded-full"
            >
              <span>{getAmenityIcon(amenity)}</span>
              <span>{amenity}</span>
            </span>
          ))}
          {room.amenities.length > 4 && (
            <span className="text-xs text-muted px-2 py-0.5">
              +{room.amenities.length - 4} more
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1">
          <span className="typo-display-sm text-secondary">${room.price}</span>
          <span className="typo-caption-sm text-muted">/ night</span>
        </div>
      </div>
    </Link>
  )
}
