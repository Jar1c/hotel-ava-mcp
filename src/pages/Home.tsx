import { useEffect } from "react"
import { Link, useLocation } from "react-router"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import SearchBar from "@/components/home/SearchBar"
import AboutSection from "@/components/home/AboutSection"
import GuestReviews from "@/components/home/GuestReviews"
import LocationSection from "@/components/home/LocationSection"
import ImageWithPlaceholder from "@/components/ui/ImageWithPlaceholder"

const featuredRooms = [
  {
    id: "standard-room",
    name: "Standard Room",
    price: "₱2,400",
    description: "Comfortable 15-20m² room with AC, hot & cold shower, WiFi, cable TV, and complimentary breakfast on 24-hour stays.",
    image: "https://hotel-ava.com/wp-content/uploads/2025/04/HACU-WEBSITE-RS-RM-79.jpg",
    badge: "Best Value",
  },
  {
    id: "deluxe-room",
    name: "Deluxe Room",
    price: "₱2,800",
    description: "Modern room with private garage access, Smart TV, and upgraded amenities. Perfect for those who value convenience.",
    image: "https://hotel-ava.com/wp-content/uploads/2025/07/HAGP-RM-4.png",
    badge: null,
  },
  {
    id: "regular-suite",
    name: "Regular Suite",
    price: "₱3,800",
    description: "Expansive suite with relaxing bathtub/jacuzzi and private garage. 30-50m² of pure comfort.",
    image: "https://hotel-ava.com/wp-content/uploads/2025/04/HAMA-ES-WEBSITE-PHOTO-RM123.png",
    badge: "Suite",
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.15 },
  }),
}

const cardContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
}

const cardItem = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

export default function Home() {
  const { hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ behavior: "smooth" })
      }
      return
    }
    window.scrollTo(0, 0)
  }, [hash])

  return (
    <div>
      {/* Hero + Search */}
      <section className="relative" style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)", minHeight: "60vh" }}>
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-linear-to-br from-primary to-secondary"
          style={{
            backgroundImage: "url('https://hotel-ava.com/wp-content/uploads/2025/07/HAMA-RM_19.png')",
          }}
        >
          <div className="absolute inset-0 bg-scrim/60" />
        </div>
        <div className="relative px-base text-center flex items-center justify-center" style={{ paddingTop: "100px", paddingBottom: "120px", minHeight: "60vh" }}>
          <div className="max-w-container mx-auto">
            <motion.p
              className="typo-caption uppercase tracking-widest mb-md"
              style={{ color: "#D4A853" }}
              custom={0}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              Welcome to Hotel Ava
            </motion.p>
            <motion.h1
              className="font-display font-bold mb-md max-w-3xl mx-auto"
              style={{ fontSize: "clamp(3rem, 6.5vw, 5.5rem)", lineHeight: 1.1, letterSpacing: "-1px", fontStyle: "italic" }}
              custom={1}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              <span className="text-on-primary">Dare To Be Different</span>{" "}
              <span className="text-[#D4A853]">here</span>
            </motion.h1>
            <motion.p
              className="text-on-primary/80 max-w-2xl mx-auto mb-lg typo-body-md"
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              Your prime drive-in hotel in the heart of Malate, Manila. Experience unique open-door concepts with private porches, themed rooms, and warm Filipino hospitality.
            </motion.p>
          </div>
        </div>
        {/* SearchBar — overlaps hero bottom edge */}
        <div className="absolute bottom-0 left-1/2 w-full px-base z-10" style={{ transform: "translate(-50%, 50%)" }}>
          <div className="mx-auto" style={{ maxWidth: "800px" }}>
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Featured Rooms */}
      <section id="rooms" className="px-base py-section">
        <div className="mx-auto" style={{ maxWidth: "var(--container-max)" }}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-md mb-xl">
            <div>
              <motion.p
                className="typo-caption uppercase tracking-widest text-primary mb-sm"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                Featured Rooms
              </motion.p>
              <motion.h2
                className="font-display italic text-ink"
                style={{ fontSize: "clamp(2rem, 3.5vw, 2.75rem)", fontWeight: 600, lineHeight: 1.15 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                Our Accommodations
              </motion.h2>
            </div>
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Link
                to="/rooms"
                className="group inline-flex items-center gap-1.5 text-muted hover:text-primary transition-colors uppercase typo-caption tracking-widest"
              >
                View All Rooms
              </Link>
            </motion.div>
          </div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-xl"
            variants={cardContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {featuredRooms.map((room) => (
              <motion.div key={room.id} variants={cardItem}>
                <Link to="/rooms" className="group block">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] mb-base">
                    <ImageWithPlaceholder
                      src={room.image}
                      alt={room.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {room.badge && (
                      <span className="absolute top-3 left-3 bg-ink/60 backdrop-blur-sm text-on-primary typo-badge uppercase px-2 py-0.5 rounded-[4px]">
                        {room.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display italic text-ink group-hover:text-primary transition-colors mb-xs" style={{ fontSize: "1.25rem", fontWeight: 500 }}>
                    {room.name}
                  </h3>
                  <p className="typo-body-sm text-muted mb-sm">{room.description}</p>
                  <div className="flex items-center justify-between">
                    <p className="typo-title-md text-ink">
                      {room.price} <span className="typo-caption text-muted">/night</span>
                    </p>
                    <ArrowRight className="h-4 w-4 text-muted group-hover:text-primary transition-all group-hover:translate-x-1" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <AboutSection />

      {/* Guest Reviews */}
      <GuestReviews />

      {/* Location */}
      <LocationSection />
    </div>
  )
}
