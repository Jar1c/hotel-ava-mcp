import { motion } from "motion/react"
import { Star } from "lucide-react"

const reviews = [
  {
    name: "Monalisa G",
    rating: 5,
    date: "June 2025",
    comment: "We had a short but pleasant stay! The place is clean and peaceful, and the guard was very accommodating and kind — such a warm welcome.",
    image: "https://i.pravatar.cc/150?img=25",
  },
  {
    name: "Alora G",
    rating: 5,
    date: "February 2025",
    comment: "I was so thrilled that I was able to get a reservation at this hotel. Staff and service has been A+ for me. Glad I called to confirm and the online reservation went smoothly!",
    image: "https://i.pravatar.cc/150?img=5",
  },
  {
    name: "Givenson A",
    rating: 4,
    date: "November 2025",
    comment: "We've been here multiple times and the rooms are great, I love our stay! Better than other hotels! Consistently good experience every time we visit.",
    image: "https://i.pravatar.cc/150?img=3",
  },
  {
    name: "Ron D.",
    rating: 5,
    date: "March 2026",
    comment: "We had a wonderful stay at Hotel Ava! The staff were warm, the room was clean and cozy, and check-in was hassle-free. A true hidden gem in Malate!",
    image: "https://i.pravatar.cc/150?img=32",
  },
  {
    name: "Purple HeartPH",
    rating: 4,
    date: "February 2026",
    comment: "Their jacuzzi expertise was the only reason we booked the hotel and it did not disappoint. Great value staycation option in Malate with unique room themes.",
    image: "https://i.pravatar.cc/150?img=44",
  },
  {
    name: "Mar co91",
    rating: 3,
    date: "March 2026",
    comment: "Overall good for the price paid. Decent accommodations with the basic amenities you need. Fair option if you're looking for a quick stay in the area.",
    image: "https://i.pravatar.cc/150?img=9",
  },
  {
    name: "Belly Pursuits",
    rating: 5,
    date: "August 2025",
    comment: "One of my most fun staycations to date, thanks to the KTV and billiards! Clean and modern amenities, super kind and accommodating staff, pet-friendly, convenient location.",
    image: "https://i.pravatar.cc/150?img=11",
  },
  {
    name: "Vic C",
    rating: 5,
    date: "October 2021",
    comment: "Perfect option to get away. For a reasonable price you get a huge and stylish room with jacuzzi. Clean and well maintained, good security, and the staff were nice and accommodating.",
    image: "https://i.pravatar.cc/150?img=1",
  },
  {
    name: "SparkLing R.",
    rating: 5,
    date: "June 2025",
    comment: "The room we stayed in is clean and neat, fully stock on toiletries and they provided us with complimentary drinks. Attendants are friendly and accommodating, checking in and out is a breeze.",
    image: "https://i.pravatar.cc/150?img=17",
  },
  {
    name: "Janvin",
    rating: 4,
    date: "July 2023",
    comment: "The jacuzzi and Netflix were great. Room was comfortable and the amenities were complete. Will definitely come back again.",
    image: "https://i.pravatar.cc/150?img=53",
  },
  {
    name: "Scott",
    rating: 5,
    date: "May 2026",
    comment: "This is my third time now staying at this hotel. First 2 times weren't so good but now is getting much better. Really improved a lot — great to see them stepping up.",
    image: "https://i.pravatar.cc/150?img=60",
  },
]

function ReviewCard({ review }: { review: typeof reviews[number] }) {
  return (
    <div
      className="flex-shrink-0 w-[320px] bg-white rounded-[20px] p-xl select-none"
    >
      <div className="flex items-center gap-3 mb-md">
        <div className="w-11 h-11 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
          <img
            src={review.image}
            alt={review.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none"
              e.currentTarget.parentElement!.classList.add("flex", "items-center", "justify-center", "text-primary", "font-semibold", "typo-title-sm")
              e.currentTarget.parentElement!.textContent = review.name.split(" ").map(n => n[0]).join("")
            }}
          />
        </div>
        <div>
          <p className="typo-title-md text-ink">{review.name}</p>
          <p className="typo-caption-sm text-muted">{review.date}</p>
        </div>
        <div className="ml-auto flex items-center gap-1 bg-surface-soft px-2.5 py-1 rounded-full">
          <Star className="h-3.5 w-3.5 fill-star-rating text-star-rating" />
          <span className="typo-caption-sm font-semibold text-ink">{review.rating}</span>
        </div>
      </div>
      <p className="typo-body-sm text-body leading-relaxed line-clamp-3">{review.comment}</p>
    </div>
  )
}

export default function GuestReviews() {
  const row1 = reviews.slice(0, 6)
  const row2 = reviews.slice(6, 12)

  return (
    <section
      className="overflow-hidden py-section"
      style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)" }}
    >
      <div className="max-w-container mx-auto px-base">
        <motion.div
          className="text-center mb-xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <div className="flex items-center justify-center gap-2 mb-sm">
            <h2 className="typo-display-lg text-ink">Guest Reviews</h2>
            <span className="inline-flex items-center gap-1 bg-surface-soft px-3 py-1 rounded-full typo-body-sm">
              <Star className="h-4 w-4 fill-star-rating text-star-rating" />
              4.2
            </span>
          </div>
          <p className="typo-body-md text-muted max-w-2xl mx-auto">
            Rated 4.2 out of 5 on Google by 494 happy guests. Here's what they say about Hotel Ava Malate.
          </p>
        </motion.div>
      </div>

      <div className="space-y-lg">
        {/* Row 1 - scrolls left */}
        <div className="carousel-row overflow-hidden">
          <div className="flex gap-lg animate-scroll-left" style={{ width: "fit-content" }}>
            {[...row1, ...row1].map((review, i) => (
              <ReviewCard key={`r1-${i}`} review={review} />
            ))}
          </div>
        </div>

        {/* Row 2 - scrolls right */}
        <div className="carousel-row overflow-hidden">
          <div className="flex gap-lg animate-scroll-right" style={{ width: "fit-content" }}>
            {[...row2, ...row2].map((review, i) => (
              <ReviewCard key={`r2-${i}`} review={review} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}