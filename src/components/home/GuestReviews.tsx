import { Star } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const reviews = [
  {
    name: "Sarah Chen",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    rating: 5,
    date: "June 2026",
    comment: "An absolutely stunning experience. The staff anticipated our every need, and the room was immaculate. The spa treatment was the highlight of our trip.",
  },
  {
    name: "Marcus Rivera",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    rating: 5,
    date: "May 2026",
    comment: "We celebrated our anniversary here and it exceeded all expectations. The fine dining restaurant is world-class, and the views from the Presidential Suite are breathtaking.",
  },
  {
    name: "Emily Watson",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    rating: 4,
    date: "April 2026",
    comment: "Beautiful property with exceptional service. The concierge helped us plan the perfect itinerary. Will definitely return for our next vacation.",
  },
]

export default function GuestReviews() {
  return (
    <section className="px-base py-section">
      <div className="mx-auto" style={{ maxWidth: "var(--container-max)" }}>
        <div className="text-center mb-xl">
          <h2 className="typo-display-lg text-ink mb-sm">Guest Reviews</h2>
          <p className="typo-body-md text-muted max-w-2xl mx-auto">
            See what our guests are saying about their experiences at Hotel Ava.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
          {reviews.map((review) => (
            <div
              key={review.name}
              className="bg-canvas rounded-lg p-lg border border-hairline"
            >
              <div className="flex items-center gap-md mb-md">
                <Avatar>
                  <AvatarImage src={review.avatar} />
                  <AvatarFallback className="bg-primary text-on-primary">
                    {review.name.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="typo-title-md text-ink">{review.name}</p>
                  <p className="typo-caption-sm text-muted">{review.date}</p>
                </div>
              </div>
              <div className="flex gap-xs mb-sm">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < review.rating ? "text-star-rating fill-star-rating" : "text-hairline"
                    }`}
                  />
                ))}
              </div>
              <p className="typo-body-sm text-body">{review.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}