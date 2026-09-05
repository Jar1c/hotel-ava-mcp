import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import ImageWithPlaceholder from "@/components/ui/ImageWithPlaceholder"

interface PhotoGalleryProps {
  images: string[]
  alt: string
}

export default function PhotoGallery({ images, alt }: PhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const goTo = (dir: "prev" | "next") => {
    if (dir === "prev") {
      setSelectedIndex((i) => (i === 0 ? images.length - 1 : i - 1))
    } else {
      setSelectedIndex((i) => (i === images.length - 1 ? 0 : i + 1))
    }
  }

  return (
    <div className="space-y-sm">
      <div className="relative aspect-[16/9] rounded-lg overflow-hidden group">
        <ImageWithPlaceholder
          src={images[selectedIndex]}
          alt={`${alt} - Image ${selectedIndex + 1}`}
          className="w-full h-full object-cover"
        />

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo("prev")}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 cursor-pointer backdrop-blur-sm"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo("next")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 cursor-pointer backdrop-blur-sm"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            {/* Image counter */}
            <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
              {selectedIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-sm overflow-x-auto pb-sm animate-fade-in">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`flex-shrink-0 w-20 h-16 rounded-sm overflow-hidden border-2 transition-all cursor-pointer ${
                index === selectedIndex
                  ? "border-primary"
                  : "border-hairline hover:border-primary/50"
              }`}
            >
              <ImageWithPlaceholder
                src={image}
                alt={`${alt} - Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
