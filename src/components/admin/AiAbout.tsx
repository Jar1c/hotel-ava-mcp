import { useState } from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  text: string
  className?: string
  align?: "left" | "center" | "right"
  size?: "sm" | "lg"
}

export default function AiAbout({ text, className, align = "left", size = "sm" }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <span className={cn("relative inline-flex group shrink-0", className)}>
      <button
        type="button"
        aria-label="About this AI feature"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={cn(
          "flex items-center justify-center rounded-full text-[#7A7A70] hover:text-[#82285f] hover:bg-[#82285f]/10 transition-colors cursor-pointer",
          size === "lg" ? "h-6 w-6" : "h-4 w-4"
        )}
      >
        <Info className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      </button>
      <span
        role="tooltip"
        className={cn(
          "absolute top-full mt-1.5 z-50 w-60 rounded-[6px] bg-[#1a1d26] px-3 py-2 text-[11px] leading-relaxed text-white shadow-lg transition-opacity duration-150 pointer-events-none",
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          align === "left" && "left-0",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "right" && "right-0"
        )}
      >
        {text}
      </span>
    </span>
  )
}
