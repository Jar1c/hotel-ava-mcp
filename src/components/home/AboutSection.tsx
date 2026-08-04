import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router"

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
}

export default function AboutSection() {
  return (
    <section id="about" className="bg-[#F5F3F3] py-[120px]" style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)" }}>
      <div className="max-w-container mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column — Text */}
        <motion.div
          className="lg:col-span-5 pr-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15 } },
          }}
        >
          <motion.span
            className="block typo-caption uppercase tracking-widest text-primary mb-6"
            variants={fadeUp}
          >
            About Hotel Ava
          </motion.span>

          <motion.h2
            className="font-display text-ink mb-8"
            style={{ fontSize: "48px", fontWeight: 700, lineHeight: "60px", letterSpacing: "-0.48px" }}
            variants={fadeUp}
          >
            Your Prime Drive-In Hotel in Malate
          </motion.h2>

          <motion.p
            className="typo-body-md text-muted leading-relaxed mb-12"
            variants={fadeUp}
          >
            Welcome to Hotel Ava, a prime drive-in hotel conveniently located at 2184 Madre Ignacia Street in Malate, Manila. We offer comfortable rooms with private garage access, perfect for guests who value privacy and convenience. Whether you're here for a quick stay or a relaxing getaway, Hotel Ava provides a warm and secure environment with thoughtfully designed spaces.
          </motion.p>

          <motion.div variants={fadeUp}>
            <Link
              to="/rooms"
              className="group inline-flex items-center gap-4 text-primary hover:text-primary-active transition-colors typo-title-sm font-semibold"
            >
              Browse Our Rooms
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </motion.div>

        {/* Right Column — Image Collage */}
        <motion.div
          className="lg:col-span-7 relative h-[650px]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.2 } },
          }}
        >
          {/* Large background image — top right */}
          <motion.div
            className="absolute top-0 right-0 w-3/4 h-[420px] overflow-hidden shadow-[0_10px_40px_0_rgba(0,0,0,0.04)]"
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              visible: {
                opacity: 1,
                scale: 1,
                transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
              },
            }}
          >
            <img
              src="https://hotel-ava.com/wp-content/uploads/2025/04/HAGP-ES-RM4.png"
              alt="Hotel Ava executive suite with private garage"
              className="w-full h-full object-cover"
            />
          </motion.div>

          {/* Suite image — bottom left */}
          <motion.div
            className="absolute bottom-4 left-0 w-1/2 h-[380px] border-8 border-white overflow-hidden shadow-[0_10px_40px_0_rgba(0,0,0,0.04)] z-10"
            variants={{
              hidden: { opacity: 0, y: 30, x: -20 },
              visible: {
                opacity: 1,
                y: 0,
                x: 0,
                transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay: 0.2 },
              },
            }}
          >
            <img
              src="https://hotel-ava.com/wp-content/uploads/2025/04/HAMA-ES-WEBSITE-PHOTO-RM123.png"
              alt="Hotel Ava Malate executive suite"
              className="w-full h-full object-cover"
            />
          </motion.div>

          {/* Living room image — bottom right */}
          <motion.div
            className="absolute bottom-16 right-8 w-2/5 h-[280px] border-8 border-white overflow-hidden shadow-[0_10px_40px_0_rgba(0,0,0,0.04)] z-20"
            variants={{
              hidden: { opacity: 0, y: 30, x: 20 },
              visible: {
                opacity: 1,
                y: 0,
                x: 0,
                transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay: 0.35 },
              },
            }}
          >
            <img
              src="https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room11.png"
              alt="Hotel Ava regular suite interior"
              className="w-full h-full object-cover"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
