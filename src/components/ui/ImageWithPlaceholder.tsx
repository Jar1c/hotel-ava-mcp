import { useState, type ImgHTMLAttributes } from "react"
import { Image } from "lucide-react"

interface ImageWithPlaceholderProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string
}

export default function ImageWithPlaceholder({
  src,
  alt,
  className = "",
  fallbackClassName = "",
  ...props
}: ImageWithPlaceholderProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <div className={`relative w-full h-full overflow-hidden ${!loaded && !error ? "bg-gray-200" : ""}`}>
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-[shimmer_1.5s_infinite]" />
      )}
      {!error ? (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          {...props}
        />
      ) : (
        <div className={`absolute inset-0 flex flex-col items-center justify-center bg-canvas-dark/20 text-muted p-4 text-center select-none ${fallbackClassName}`}>
          <Image className="w-8 h-8 opacity-30 mb-1" />
          <span className="text-[10px] uppercase tracking-wider opacity-50 font-medium">Image Unavailable</span>
        </div>
      )}
    </div>
  )
}
