import { Link } from "react-router-dom"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import SearchBar from "@/components/home/SearchBar"
import WhyHotelAva from "@/components/home/WhyHotelAva"
import GuestReviews from "@/components/home/GuestReviews"
import LocationSection from "@/components/home/LocationSection"

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
    <div>
      {/* Hero + Search */}
      <section className="relative h-[500px] md:h-[600px]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&h=900&fit=crop')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-scrim/80 via-scrim/30 to-scrim/50" />
        </div>
        <div className="relative h-full flex flex-col justify-end pb-xl px-base">
          <div className="mx-auto w-full" style={{ maxWidth: "var(--container-max)" }}>
            <div className="mb-lg">
              <h1 className="typo-display-xl text-on-primary mb-sm">Find Your Perfect Stay</h1>
              <p className="typo-body-md text-on-primary/90 max-w-xl">
                Discover luxury accommodations and create unforgettable memories at Hotel Ava.
              </p>
            </div>
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Featured Rooms */}
      <section className="px-base py-section">
        <div className="mx-auto" style={{ maxWidth: "var(--container-max)" }}>
          <h2 className="typo-display-lg text-ink mb-lg">Featured Rooms</h2>
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
        </div>
      </section>

      {/* Why Hotel Ava */}
      <WhyHotelAva />

      {/* Guest Reviews */}
      <GuestReviews />

      {/* Location */}
      <LocationSection />
    </div>
  )
}