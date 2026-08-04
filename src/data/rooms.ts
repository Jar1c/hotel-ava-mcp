export interface Room {
  id: string
  name: string
  type: string
  description: string
  price: number
  capacity: number
  amenities: string[]
  images: string[]
  rating?: number
  reviews?: number
  featured?: boolean
  bookedDates?: string[]
}

export const rooms: Room[] = [
  {
    id: "standard-room",
    name: "Standard Room",
    type: "Standard",
    description: "Comfortable 15-20m² room with air conditioning, hot & cold shower, WiFi, cable TV, hairdryer, and personal care kit. Perfect for travelers arriving via taxi or service vehicle.",
    price: 2400,
    capacity: 2,
    amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Cable TV", "Hairdryer", "Personal Care Kit"],
    images: [
      "https://hotel-ava.com/wp-content/uploads/2025/04/HACU-WEBSITE-RS-RM-79.jpg",
      "https://hotel-ava.com/wp-content/uploads/2025/07/HAGP-RM-4.png",
      "https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room83.png"
    ],
    rating: 4.2,
    reviews: 120,
    featured: true,
    bookedDates: ["2026-06-15", "2026-06-22", "2026-07-05"]
  },
  {
    id: "deluxe-room",
    name: "Deluxe Room",
    type: "Deluxe",
    description: "Modern 18-24m² room with private garage access, Smart TV, and upgraded amenities. Perfect for those moments when you need to detour.",
    price: 2800,
    capacity: 2,
    amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage"],
    images: [
      "https://hotel-ava.com/wp-content/uploads/2025/07/HAGP-RM-4.png",
      "https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room29.png",
      "https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room04.png"
    ],
    rating: 4.3,
    reviews: 95,
    featured: true,
    bookedDates: ["2026-06-18", "2026-06-25", "2026-07-08"]
  },
  {
    id: "executive-deluxe",
    name: "Executive Deluxe",
    type: "Deluxe",
    description: "Spacious room with private garage, bathtub, and premium finishes. A step up in luxury with extra space for a truly relaxing stay.",
    price: 3200,
    capacity: 2,
    amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage", "Bathtub"],
    images: [
      "https://hotel-ava.com/wp-content/uploads/2025/04/HAGP-ES-RM4.png",
      "https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room55.png",
      "https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room70.png"
    ],
    rating: 4.5,
    reviews: 78,
    featured: false,
    bookedDates: ["2026-06-20", "2026-06-27", "2026-07-10"]
  },
  {
    id: "regular-suite",
    name: "Regular Suite",
    type: "Suite",
    description: "Expansive 30-50m² suite with relaxing bathtub/jacuzzi and private garage. Designed for guests who want extra space and a touch of indulgence.",
    price: 3800,
    capacity: 4,
    amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage", "Bathtub", "Jacuzzi"],
    images: [
      "https://hotel-ava.com/wp-content/uploads/2025/04/HAMA-ES-WEBSITE-PHOTO-RM123.png",
      "https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room11.png",
      "https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room15.png"
    ],
    rating: 4.6,
    reviews: 64,
    featured: true,
    bookedDates: ["2026-06-26", "2026-06-28", "2026-07-04"]
  },
  {
    id: "superior-suite",
    name: "Superior Suite",
    type: "Suite",
    description: "Our finest accommodation featuring themed rooms, a private jacuzzi, and KTV entertainment system. The ultimate experience for celebrations and special occasions.",
    price: 4500,
    capacity: 4,
    amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage", "Jacuzzi", "KTV"],
    images: [
      "https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room128-asgard.png",
      "https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room-asgard02.png",
      "https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room-batcave.png"
    ],
    rating: 4.7,
    reviews: 52,
    featured: false,
    bookedDates: ["2026-06-17", "2026-06-30", "2026-07-12"]
  }
]

export const getRoomById = (id: string): Room | undefined => {
  return rooms.find(room => room.id === id)
}

export const getAmenityIcon = (amenity: string): string => {
  const icons: Record<string, string> = {
    "Free WiFi": "Wifi",
    "Air Conditioning": "Wind",
    "Hot & Cold Shower": "Droplets",
    "Cable TV": "Tv",
    "Smart TV": "Tv",
    "Hairdryer": "Wind",
    "Personal Care Kit": "Sparkles",
    "Private Garage": "Building2",
    "Bathtub": "Bath",
    "Jacuzzi": "Bath",
    "KTV": "Music",
    "TV": "Tv"
  }
  return icons[amenity] || "Sparkles"
}
