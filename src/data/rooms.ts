export interface Room {
  id: string
  name: string
  type: string
  description: string
  price: number
  capacity: number
  amenities: string[]
  images: string[]
  rating: number
  reviews: number
  featured: boolean
}

export const rooms: Room[] = [
  {
    id: "deluxe-suite",
    name: "Deluxe Suite",
    type: "Suite",
    description: "Spacious suite with panoramic city views, king-sized bed, and luxury amenities. Perfect for couples seeking a romantic getaway.",
    price: 299,
    capacity: 2,
    amenities: ["Free WiFi", "Air Conditioning", "Mini Bar", "Room Service", "City View", "King Bed"],
    images: [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1590490360182-c33d955e4b76?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop"
    ],
    rating: 4.8,
    reviews: 124,
    featured: true
  },
  {
    id: "garden-room",
    name: "Garden Room",
    type: "Standard",
    description: "Cozy room overlooking our botanical gardens. Features modern decor and natural light throughout the day.",
    price: 199,
    capacity: 2,
    amenities: ["Free WiFi", "Air Conditioning", "Garden View", "Queen Bed", "Coffee Maker"],
    images: [
      "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&h=600&fit=crop"
    ],
    rating: 4.6,
    reviews: 89,
    featured: false
  },
  {
    id: "presidential-suite",
    name: "Presidential Suite",
    type: "Premium Suite",
    description: "The ultimate luxury experience with private terrace, jacuzzi, and dedicated butler service.",
    price: 599,
    capacity: 4,
    amenities: ["Free WiFi", "Private Terrace", "Jacuzzi", "Butler Service", "Living Room", "King Bed", "Mini Bar", "Room Service"],
    images: [
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=800&h=600&fit=crop"
    ],
    rating: 4.9,
    reviews: 67,
    featured: true
  },
  {
    id: "family-room",
    name: "Family Room",
    type: "Family",
    description: "Spacious room designed for families with two queen beds and connecting bathroom options.",
    price: 249,
    capacity: 4,
    amenities: ["Free WiFi", "Air Conditioning", "Two Queen Beds", "Bathtub", "Kids Amenities"],
    images: [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&h=600&fit=crop"
    ],
    rating: 4.7,
    reviews: 156,
    featured: false
  },
  {
    id: "ocean-view",
    name: "Ocean View Room",
    type: "Premium",
    description: "Wake up to stunning ocean views. Features floor-to-ceiling windows and private balcony.",
    price: 349,
    capacity: 2,
    amenities: ["Free WiFi", "Ocean View", "Private Balcony", "King Bed", "Rain Shower", "Mini Bar"],
    images: [
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&h=600&fit=crop"
    ],
    rating: 4.8,
    reviews: 203,
    featured: true
  },
  {
    id: "executive-room",
    name: "Executive Room",
    type: "Business",
    description: "Designed for business travelers with work desk, ergonomic chair, and high-speed internet.",
    price: 229,
    capacity: 1,
    amenities: ["Free WiFi", "Work Desk", "Ergonomic Chair", "Queen Bed", "Coffee Maker", "Iron & Board"],
    images: [
      "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1560448075-bb7f0563c69d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1585412727339-53e48969a9b3?w=800&h=600&fit=crop"
    ],
    rating: 4.5,
    reviews: 98,
    featured: false
  },
  {
    id: "penthouse",
    name: "Penthouse Suite",
    type: "Luxury",
    description: "Our most exclusive accommodation with panoramic views, private pool, and rooftop terrace.",
    price: 899,
    capacity: 6,
    amenities: ["Free WiFi", "Private Pool", "Rooftop Terrace", "Butler Service", "King Bed", "Living Room", "Dining Area", "Mini Bar", "Room Service"],
    images: [
      "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop"
    ],
    rating: 4.9,
    reviews: 42,
    featured: true
  },
  {
    id: "standard-queen",
    name: "Standard Queen",
    type: "Standard",
    description: "Comfortable and affordable room with all essential amenities for a pleasant stay.",
    price: 149,
    capacity: 2,
    amenities: ["Free WiFi", "Air Conditioning", "Queen Bed", "TV", "Coffee Maker"],
    images: [
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&h=600&fit=crop"
    ],
    rating: 4.4,
    reviews: 267,
    featured: false
  }
]

export const getRoomById = (id: string): Room | undefined => {
  return rooms.find(room => room.id === id)
}

export const getAmenityIcon = (amenity: string): string => {
  const icons: Record<string, string> = {
    "Free WiFi": "📶",
    "Air Conditioning": "❄️",
    "Mini Bar": "🍸",
    "Room Service": "🛎️",
    "City View": "🏙️",
    "King Bed": "🛏️",
    "Queen Bed": "🛏️",
    "Garden View": "🌿",
    "Coffee Maker": "☕",
    "Private Terrace": "🌅",
    "Jacuzzi": "🛁",
    "Butler Service": "👨‍🍳",
    "Living Room": "🛋️",
    "Bathtub": "🛁",
    "Kids Amenities": "👶",
    "Ocean View": "🌊",
    "Private Balcony": "🏖️",
    "Rain Shower": "🚿",
    "Work Desk": "💼",
    "Ergonomic Chair": "🪑",
    "Iron & Board": "👔",
    "Private Pool": "🏊",
    "Rooftop Terrace": "🌇",
    "Dining Area": "🍽️",
    "TV": "📺"
  }
  return icons[amenity] || "✨"
}
