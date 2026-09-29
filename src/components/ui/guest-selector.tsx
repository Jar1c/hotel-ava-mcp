import { useState, useRef, useEffect } from "react"
import { Users, Minus, Plus } from "lucide-react"

export interface GuestCount {
  adults: number
  children: number
  pets: number
}

interface GuestSelectorProps {
  value: GuestCount
  onChange: (value: GuestCount) => void
  maxAdults?: number
  maxChildren?: number
  allowChildren?: boolean
  maxPets?: number
  allowPets?: boolean
}

export default function GuestSelector({ value, onChange, maxAdults = 10, maxChildren = 10, allowChildren = true, maxPets = 2, allowPets = false }: GuestSelectorProps) {
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
    newVal[key] = newVal[key] + delta

    if (key === "adults") {
      newVal.adults = Math.max(0, Math.min(maxAdults, newVal.adults))
    } else if (key === "children") {
      if (!allowChildren) return
      newVal.children = Math.max(0, Math.min(maxChildren, newVal.children))
    } else if (key === "pets") {
      if (!allowPets) return
      newVal.pets = Math.max(0, Math.min(maxPets, newVal.pets))
    }

    onChange(newVal)
  }

  const summary = value.adults === 0
    ? "Select guests"
    : `${value.adults} ${value.adults === 1 ? "Adult" : "Adults"}${value.children > 0 ? `, ${value.children} Child${value.children > 1 ? "ren" : ""}` : ""}${value.pets > 0 ? `, ${value.pets} Pet${value.pets > 1 ? "s" : ""}` : ""}`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer"
      >
        <Users className="h-4 w-4 text-muted shrink-0" />
        <span className={`typo-body-sm whitespace-nowrap ${value.adults === 0 ? "text-muted" : "text-ink"}`}>{summary}</span>
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
                disabled={value.adults <= 0}
                className="size-8 rounded-full border border-hairline flex items-center justify-center text-ink hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center font-semibold text-ink">{value.adults}</span>
              <button
                type="button"
                onClick={() => updateValue("adults", 1)}
                disabled={value.adults >= maxAdults}
                className="size-8 rounded-full border border-hairline flex items-center justify-center text-ink hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Children */}
          {allowChildren && (
            <div className="flex items-center justify-between py-3 border-b border-hairline">
              <div>
                <p className="typo-body-sm text-ink font-medium">Children</p>
                <p className="typo-caption-sm text-muted">Age 0-17</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => updateValue("children", -1)}
                  disabled={value.children <= 0 || !allowChildren}
                  className="size-8 rounded-full border border-hairline flex items-center justify-center text-ink hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center font-semibold text-ink">{value.children}</span>
                <button
                  type="button"
                  onClick={() => updateValue("children", 1)}
                  disabled={value.children >= maxChildren || !allowChildren}
                  className="size-8 rounded-full border border-hairline flex items-center justify-center text-ink hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Pets */}
          {allowPets && (
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="typo-body-sm text-ink font-medium">Pets</p>
                <p className="typo-caption-sm text-muted">Max {maxPets} allowed per room</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => updateValue("pets", -1)}
                  disabled={value.pets <= 0 || !allowPets}
                  className="size-8 rounded-full border border-hairline flex items-center justify-center text-ink hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center font-semibold text-ink">{value.pets}</span>
                <button
                  type="button"
                  onClick={() => updateValue("pets", 1)}
                  disabled={value.pets >= maxPets || !allowPets}
                  className="size-8 rounded-full border border-hairline flex items-center justify-center text-ink hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}