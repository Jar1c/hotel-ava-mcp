import { useState, useRef, useEffect } from "react"
import { Users, Minus, Plus } from "lucide-react"

export interface GuestCount {
  adults: number
  children: number
}

interface GuestSelectorProps {
  value: GuestCount
  onChange: (value: GuestCount) => void
}

export default function GuestSelector({ value, onChange }: GuestSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const updateValue = (key: keyof GuestCount, delta: number) => {
    const newVal = { ...value }
    newVal[key] = Math.max(
      key === "adults" ? 1 : 0,
      Math.min(10, newVal[key] + delta)
    )
    onChange(newVal)
  }

  const summary = `${value.adults} ${value.adults === 1 ? "Adult" : "Adults"}${value.children > 0 ? `, ${value.children} Child${value.children > 1 ? "ren" : ""}` : ""}`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer"
      >
        <Users className="h-4 w-4 text-muted shrink-0" />
        <span className="typo-body-sm text-ink truncate">{summary}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-white rounded-[12px] shadow-dropdown border border-hairline z-50 p-4">
          {/* Adults */}
          <div className="flex items-center justify-between py-3 border-b border-hairline">
            <div>
              <p className="typo-body-sm text-ink font-medium">Adults</p>
              <p className="typo-caption-sm text-muted">Age 18 or above</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateValue("adults", -1)}
                disabled={value.adults <= 1}
                className="size-8 rounded-full border border-hairline flex items-center justify-center text-ink hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center font-semibold text-ink">{value.adults}</span>
              <button
                type="button"
                onClick={() => updateValue("adults", 1)}
                className="size-8 rounded-full border border-hairline flex items-center justify-center text-ink hover:bg-gray-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Children */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="typo-body-sm text-ink font-medium">Children</p>
              <p className="typo-caption-sm text-muted">Age 0-17</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateValue("children", -1)}
                disabled={value.children <= 0}
                className="size-8 rounded-full border border-hairline flex items-center justify-center text-ink hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center font-semibold text-ink">{value.children}</span>
              <button
                type="button"
                onClick={() => updateValue("children", 1)}
                className="size-8 rounded-full border border-hairline flex items-center justify-center text-ink hover:bg-gray-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}