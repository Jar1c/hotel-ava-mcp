import { Link } from "react-router"
import { Star, Users, Wifi, Wind, Wine, ConciergeBell, Building2, BedDouble, TreePine, Coffee, Tv, Monitor, Waves, Fence, Bath, CookingPot, Sofa, UtensilsCrossed, Mountain, Sunrise, Shirt, Sunset, UserCheck, Eye, Lock, Baby, Sparkles, Music, Droplets } from "lucide-react"
import type { Room } from "@/data/rooms"
import type { FilterState } from "@/components/rooms/SearchFilters"
import ImageWithPlaceholder from "@/components/ui/ImageWithPlaceholder"

interface RoomCardProps {
  room: Room
  filters?: FilterState
}

const amenityIcons: Record<string, React.ReactNode> = {
  "Free WiFi": <Wifi className="h-3 w-3" />,
  "Air Conditioning": <Wind className="h-3 w-3" />,
  "Mini Bar": <Wine className="h-3 w-3" />,
  "Room Service": <ConciergeBell className="h-3 w-3" />,
  "City View": <Building2 className="h-3 w-3" />,
  "King Bed": <BedDouble className="h-3 w-3" />,
  "Queen Bed": <BedDouble className="h-3 w-3" />,
  "Extra Bed": <BedDouble className="h-3 w-3" />,
  "Garden View": <TreePine className="h-3 w-3" />,
  "Coffee Maker": <Coffee className="h-3 w-3" />,
  "Breakfast": <Coffee className="h-3 w-3" />,
  "Flat-screen TV": <Tv className="h-3 w-3" />,
  "Smart TV": <Tv className="h-3 w-3" />,
  "Work Desk": <Monitor className="h-3 w-3" />,
  "Ocean View": <Waves className="h-3 w-3" />,
  "Pool": <Waves className="h-3 w-3" />,
  "Private Pool": <Waves className="h-3 w-3" />,
  "Beach Access": <Waves className="h-3 w-3" />,
  "Private Terrace": <Fence className="h-3 w-3" />,
  "Private Balcony": <Fence className="h-3 w-3" />,
  "Jacuzzi": <Bath className="h-3 w-3" />,
  "Premium Toiletries": <Bath className="h-3 w-3" />,
  "Marble Bathroom": <Bath className="h-3 w-3" />,
  "Kitchenette": <CookingPot className="h-3 w-3" />,
  "Living Area": <Sofa className="h-3 w-3" />,
  "Dining Table": <UtensilsCrossed className="h-3 w-3" />,
  "Mountain View": <Mountain className="h-3 w-3" />,
  "Natural Light": <Sunrise className="h-3 w-3" />,
  "Walk-in Closet": <Shirt className="h-3 w-3" />,
  "Laundry": <Shirt className="h-3 w-3" />,
  "Rooftop Terrace": <Sunset className="h-3 w-3" />,
  "Butler": <UserCheck className="h-3 w-3" />,
  "Panoramic View": <Eye className="h-3 w-3" />,
  "Personal Safe": <Lock className="h-3 w-3" />,
  "Baby Cot": <Baby className="h-3 w-3" />,
  "Concierge": <ConciergeBell className="h-3 w-3" />,
  "Spa Access": <Sparkles className="h-3 w-3" />,
  "Hot & Cold Shower": <Droplets className="h-3 w-3" />,
  "Hairdryer": <Wind className="h-3 w-3" />,
  "Personal Care Kit": <Sparkles className="h-3 w-3" />,
  "Private Garage": <Building2 className="h-3 w-3" />,
  "KTV": <Music className="h-3 w-3" />,
  "Cable TV": <Tv className="h-3 w-3" />,
}

export default function RoomCard({ room, filters }: RoomCardProps) {
  const detailUrl = (() => {
    const params = new URLSearchParams()
    if (filters?.checkIn) params.set("checkIn", filters.checkIn)
    if (filters?.checkOut) params.set("checkOut", filters.checkOut)
    if (filters?.guests && filters.guests > 0) params.set("guests", String(filters.guests))
    const qs = params.toString()
    return `/rooms/${room.id}${qs ? `?${qs}` : ""}`
  })()

  return (
    <Link to={detailUrl} className="group block h-full">
      <div className="bg-canvas rounded-lg hover:shadow-card-hover transition-all overflow-hidden flex flex-col h-full">
        <div className="relative overflow-hidden aspect-[16/9]">
          <ImageWithPlaceholder
            src={room.images[0]}
            alt={room.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {room.featured && (
            <span className="absolute top-3 left-3 bg-secondary/80 backdrop-blur-sm text-on-primary typo-badge uppercase px-2 py-0.5 rounded-[4px] tracking-wide">
              Featured
            </span>
          )}
          {room.rating != null && (
            <div className="absolute bottom-3 right-3 bg-canvas/80 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
              <Star className="h-3 w-3 fill-star-rating text-star-rating" />
              <span className="typo-caption-sm text-ink font-semibold">{room.rating}</span>
              {room.reviews != null && (
                <span className="typo-caption-sm text-muted">({room.reviews})</span>
              )}
            </div>
          )}
        </div>

        <div className="p-3 flex flex-col gap-1.5 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="typo-title-md font-bold text-ink leading-tight group-hover:text-primary transition-colors">
              {room.name}
            </h3>
            <div className="flex items-center gap-1 text-muted shrink-0 mt-0.5">
              <Users className="h-3.5 w-3.5" />
              <span className="typo-caption-sm font-medium">{room.capacity}</span>
            </div>
          </div>

          <p className="typo-caption-sm uppercase tracking-wider text-muted">
            {room.type}
          </p>

          <div className="flex flex-col gap-0.5 mt-auto pt-1 mb-2">
            {(() => {
              const visible = room.amenities.slice(0, 5)
              const remainder = room.amenities.length > 5 ? room.amenities.length - 5 : 0
              const rows = [
                { items: visible.slice(0, 2), align: "justify-start" as const },
                { items: visible.slice(2, 4), align: "justify-start" as const },
                { items: visible.slice(4, 5), align: "justify-start" as const },
              ]
              return rows.map((row, ri) =>
                row.items.length > 0 ? (
                  <div key={ri} className={`flex items-center gap-1 ${row.align}`}>
                    {row.items.map((amenity) => (
                      <span key={amenity} className="inline-flex items-center gap-1 bg-surface-soft px-1.5 py-0.5 rounded-full text-[11px] text-body leading-none">
                        {amenityIcons[amenity] || <Sparkles className="h-2.5 w-2.5" />}
                        <span>{amenity}</span>
                      </span>
                    ))}
                    {ri === 2 && remainder > 0 && (
                      <span className="text-[11px] text-muted leading-none ml-0.5">+{remainder}</span>
                    )}
                  </div>
                ) : null
              )
            })()}
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-secondary font-bold typo-display-sm">&#x20B1;{room.price.toLocaleString()}</span>
            <span className="typo-caption-sm text-muted">/ night</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
