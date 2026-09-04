interface LoadingDots {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeMap = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
}

const gapMap = {
  sm: "gap-1",
  md: "gap-1.5",
  lg: "gap-2",
}

export default function LoadingDots({ size = "md", className = "" }: LoadingDots) {
  return (
    <div className={`inline-flex items-center ${gapMap[size]} ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`${sizeMap[size]} rounded-full bg-current loading-dot`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}
