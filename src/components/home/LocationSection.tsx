import { motion } from "motion/react"
import { MapPin, Phone, Clock } from "lucide-react"

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

            <motion.div className="mt-lg pt-lg border-t border-hairline" variants={staggerItem}>
              <p className="typo-caption text-muted mb-sm">Nearby Landmarks</p>
              <div className="flex flex-wrap gap-sm">
                {["Manila Baywalk", "Manila Zoo", "Malate Church", "DLSU-Manila", "Robinsons Place Manila"].map((attraction) => (
                  <span
                    key={attraction}
                    className="typo-caption-sm bg-surface-soft text-body px-sm py-xs rounded-full"
                  >
                    {attraction}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
