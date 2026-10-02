import { motion } from "motion/react"
import { MapPin, Phone, Clock } from "lucide-react"
import { travelLabel } from "@/data/nearbyPlaces"

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
}

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

const MAP_EMBED_URL =
  "https://maps.google.com/maps?q=2184+Madre+Ignacia+Street+Malate+Manila+Philippines&t=&z=15&ie=UTF8&iwloc=&output=embed"

/**
 * Photos in /public/places — Wikimedia Commons (stored in the repo):
 * baywalk.jpg © Vyacheslav Argenberg (CC BY 4.0), manila-zoo.jpg © Ramon F.
 * Velasquez (CC BY-SA 3.0), malate-church.jpg © Patrick Roque (CC BY-SA 4.0),
 * robinsons.jpg © Ralff Nestor Nacor (CC BY-SA 4.0), dlsu-manila.jpg © Patrick
 * Roque (CC BY-SA 3.0).
 */
const landmarks = [
  { name: "Manila Baywalk", image: "/places/baywalk.jpg", km: 0.9 },
  { name: "Manila Zoo", image: "/places/manila-zoo.jpg", km: 1.4 },
  { name: "Malate Church", image: "/places/malate-church.jpg", km: 1.2 },
  { name: "DLSU-Manila", image: "/places/dlsu-manila.jpg", km: 1.0 },
  { name: "Robinsons Place Manila", image: "/places/robinsons.jpg", km: 1.3 },
]

export default function LocationSection() {
  return (
    <section id="contact" className="px-base py-section bg-surface-soft">
      <div className="max-w-container mx-auto">
        <motion.div
          className="text-center mb-xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <h2 className="typo-display-lg text-ink mb-sm">Find Us</h2>
          <p className="typo-body-md text-muted max-w-2xl mx-auto">
            Conveniently located at 2184 Madre Ignacia Street in Malate, Manila. Just a 5-minute walk to Manila Bay and near major landmarks.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          {/* Google Maps Embed */}
          <motion.div
            className="rounded-lg border border-hairline overflow-hidden h-80"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
          >
            <iframe
              src={MAP_EMBED_URL}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Hotel Ava Location"
              className="w-full h-full"
            />
          </motion.div>

          {/* Contact Info */}
          <motion.div
            className="bg-canvas rounded-lg border border-hairline p-lg"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <motion.h3 className="typo-display-md text-ink mb-lg" variants={staggerItem}>
              Contact Information
            </motion.h3>
            
            <div className="space-y-lg">
              <motion.div className="flex items-start gap-md" variants={staggerItem}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="typo-title-md text-ink">Address</p>
                  <p className="typo-body-sm text-muted">2184 Madre Ignacia Street, corner Quirino Ave, Malate, Manila</p>
                </div>
              </motion.div>

              <motion.div className="flex items-start gap-md" variants={staggerItem}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="typo-title-md text-ink">Phone</p>
                  <p className="typo-body-sm text-muted">+63 926 006 8565 / +63 2 5310-1731 to 32</p>
                </div>
              </motion.div>

              <motion.div className="flex items-start gap-md" variants={staggerItem}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="typo-title-md text-ink">Stay Options</p>
                  <p className="typo-body-sm text-muted">12 Hours | 24 Hours</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Nearby landmarks with photos */}
        <motion.div
          className="mt-xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <motion.h3 className="typo-display-md text-ink mb-lg text-center" variants={staggerItem}>
            Nearby Landmarks
          </motion.h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-md">
            {landmarks.map((place) => (
              <motion.div
                key={place.name}
                variants={staggerItem}
                className="group overflow-hidden rounded-[12px] border border-hairline bg-canvas transition-shadow hover:shadow-card-hover"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={place.image}
                    alt={`${place.name} — nearby Hotel Ava`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-sm">
                  <p className="typo-body-sm font-semibold text-ink">{place.name}</p>
                  <p className="typo-caption-sm text-muted mt-xs">{travelLabel(place.km)}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p className="typo-caption-sm text-muted-soft mt-md text-center" variants={staggerItem}>
            Landmark photos via Wikimedia Commons (CC BY / CC BY-SA)
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}
