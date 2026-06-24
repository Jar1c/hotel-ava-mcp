import { Link } from "react-router-dom"
import { Card, CardContent, CardTitle } from "@/components/ui/card"

const featuredRooms = [
  {
    id: "1",
    name: "Deluxe Suite",
    price: "$299",
    description: "Spacious suite with panoramic city views",
    image: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&h=400&fit=crop",
    badge: "Guest Favorite",
  },
  {
    id: "2",
    name: "Garden Room",
    price: "$199",
    description: "Cozy room overlooking our botanical gardens",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&h=400&fit=crop",
    badge: null,
  },
  {
    id: "3",
    name: "Presidential Suite",
    price: "$599",
    description: "The ultimate luxury experience with private terrace",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&h=400&fit=crop",
    badge: "Premium",
  },
]

export default function Home() {
  return (
    <div className="px-base py-section">
      <div className="mb-section">
        <h1 className="typo-display-xl mb-lg">Welcome to Hotel Ava</h1>
        <p className="typo-body-md text-body max-w-2xl">
          Experience personalized luxury at Hotel Ava. Browse our curated rooms, enjoy premium amenities, and let our smart recommendations find the perfect stay for you.
        </p>
        <div className="mt-xl">
          <Link
            to="/rooms"
            className="inline-block rounded-sm bg-primary text-on-primary px-lg py-sm typo-button-md hover:bg-primary-active transition-colors"
          >
            Browse Rooms
          </Link>
        </div>
      </div>

      <section>
        <h2 className="typo-display-lg mb-lg">Featured Rooms</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-lg">
          {featuredRooms.map((room) => (
            <Link key={room.id} to="/rooms" className="group block">
              <Card className="rounded-lg overflow-hidden transition-shadow hover:shadow-card-hover">
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {room.badge && (
                    <span className="absolute top-sm left-sm bg-secondary text-on-primary typo-badge px-sm py-xs rounded-full">
                      {room.badge}
                    </span>
                  )}
                </div>
                <CardContent className="p-lg">
                  <CardTitle className="typo-display-md mb-sm">{room.name}</CardTitle>
                  <p className="typo-body-sm text-muted mb-md">{room.description}</p>
                  <p className="typo-title-md text-primary">{room.price} / night</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}