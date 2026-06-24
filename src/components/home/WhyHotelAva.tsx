import { Wifi, Car, UtensilsCrossed, Heart, Shield, Headphones } from "lucide-react"

const amenities = [
  {
    icon: Wifi,
    title: "High-Speed WiFi",
    description: "Complimentary fiber-optic internet throughout the property",
  },
  {
    icon: Car,
    title: "Valet Parking",
    description: "Complimentary valet service for all hotel guests",
  },
  {
    icon: UtensilsCrossed,
    title: "Fine Dining",
    description: "Award-winning restaurant with locally sourced ingredients",
  },
  {
    icon: Heart,
    title: "Luxury Spa",
    description: "Full-service spa with signature treatments and wellness programs",
  },
  {
    icon: Shield,
    title: "24/7 Security",
    description: "Round-the-clock security and in-room safe for your peace of mind",
  },
  {
    icon: Headphones,
    title: "Personal Concierge",
    description: "Dedicated concierge to plan your perfect stay",
  },
]

export default function WhyHotelAva() {
  return (
    <section className="px-base py-section bg-surface-soft">
      <div className="mx-auto" style={{ maxWidth: "var(--container-max)" }}>
        <div className="text-center mb-xl">
          <h2 className="typo-display-lg text-ink mb-sm">Why Hotel Ava</h2>
          <p className="typo-body-md text-muted max-w-2xl mx-auto">
            Every detail is designed to make your stay unforgettable. From our personalized service to our world-class amenities, we redefine hospitality.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-lg">
          {amenities.map((amenity) => (
            <div
              key={amenity.title}
              className="bg-canvas rounded-lg p-lg border border-hairline hover:shadow-card-hover transition-shadow"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-md">
                <amenity.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="typo-title-md text-ink mb-sm">{amenity.title}</h3>
              <p className="typo-body-sm text-muted">{amenity.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}