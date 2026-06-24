import { MapPin, Phone, Clock } from "lucide-react"

export default function LocationSection() {
  return (
    <section className="px-base py-section bg-surface-soft">
      <div className="mx-auto" style={{ maxWidth: "var(--container-max)" }}>
        <div className="text-center mb-xl">
          <h2 className="typo-display-lg text-ink mb-sm">Find Us</h2>
          <p className="typo-body-md text-muted max-w-2xl mx-auto">
            Conveniently located in the heart of the city, with easy access to major attractions and business districts.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          {/* Map Placeholder */}
          <div className="bg-canvas rounded-lg border border-hairline overflow-hidden h-80">
            <div className="w-full h-full bg-surface-strong flex items-center justify-center">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-primary mx-auto mb-md" />
                <p className="typo-title-md text-ink">123 Luxury Avenue</p>
                <p className="typo-body-sm text-muted">Downtown District, City 12345</p>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-canvas rounded-lg border border-hairline p-lg">
            <h3 className="typo-display-md text-ink mb-lg">Contact Information</h3>
            
            <div className="space-y-lg">
              <div className="flex items-start gap-md">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="typo-title-md text-ink">Address</p>
                  <p className="typo-body-sm text-muted">123 Luxury Avenue, Downtown District, City 12345</p>
                </div>
              </div>

              <div className="flex items-start gap-md">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="typo-title-md text-ink">Phone</p>
                  <p className="typo-body-sm text-muted">+1 (555) 123-4567</p>
                </div>
              </div>

              <div className="flex items-start gap-md">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="typo-title-md text-ink">Check-in / Check-out</p>
                  <p className="typo-body-sm text-muted">Check-in: 3:00 PM | Check-out: 11:00 AM</p>
                </div>
              </div>
            </div>

            <div className="mt-lg pt-lg border-t border-hairline">
              <p className="typo-caption text-muted mb-sm">Nearby Attractions</p>
              <div className="flex flex-wrap gap-sm">
                {["City Center (0.5 mi)", "Airport (12 mi)", "Beach (3 mi)", "Shopping (0.3 mi)"].map((attraction) => (
                  <span
                    key={attraction}
                    className="typo-caption-sm bg-surface-soft text-body px-sm py-xs rounded-full"
                  >
                    {attraction}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}