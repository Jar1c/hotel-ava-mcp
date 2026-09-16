export interface DiscountRoom {
  id: string
  name: string
  type: string
  price: number
}

export interface ActiveDiscount {
  id: string
  eventRoomTypeKey: string
  roomId: string
  roomType: string
  roomName: string
  discountPercent: number
  discountedPrice: number
  originalPrice: number
  reason: string
  event: string
  validFrom: string
  validTo: string
  isHolidayPromo: boolean
}

export interface HolidayEvent {
  name: string
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
  discountRange: [number, number]
  affectedTypes: string[]
}

const HOLIDAY_EVENTS: HolidayEvent[] = [
  {
    name: "New Year's Celebration",
    startMonth: 1, startDay: 1, endMonth: 1, endDay: 5,
    discountRange: [10, 15],
    affectedTypes: ["Standard", "Deluxe", "Suite"],
  },
  {
    name: "Sinulog Festival",
    startMonth: 1, startDay: 15, endMonth: 1, endDay: 20,
    discountRange: [5, 10],
    affectedTypes: ["Standard", "Deluxe", "Suite"],
  },
  {
    name: "Valentine's Special",
    startMonth: 2, startDay: 10, endMonth: 2, endDay: 15,
    discountRange: [10, 20],
    affectedTypes: ["Deluxe", "Suite"],
  },
  {
    name: "Summer Kickoff",
    startMonth: 3, startDay: 1, endMonth: 3, endDay: 31,
    discountRange: [5, 10],
    affectedTypes: ["Standard"],
  },
  {
    name: "Holy Week Promo",
    startMonth: 4, startDay: 1, endMonth: 4, endDay: 10,
    discountRange: [15, 25],
    affectedTypes: ["Standard", "Deluxe", "Suite"],
  },
  {
    name: "Graduation Season",
    startMonth: 4, startDay: 15, endMonth: 5, endDay: 15,
    discountRange: [8, 12],
    affectedTypes: ["Standard", "Deluxe"],
  },
  {
    name: "Mother's Day Special",
    startMonth: 5, startDay: 5, endMonth: 5, endDay: 12,
    discountRange: [10, 15],
    affectedTypes: ["Suite"],
  },
  {
    name: "Independence Day Promo",
    startMonth: 6, startDay: 8, endMonth: 6, endDay: 14,
    discountRange: [10, 15],
    affectedTypes: ["Standard", "Deluxe"],
  },
  {
    name: "Rainy Season Savings",
    startMonth: 6, startDay: 15, endMonth: 7, endDay: 31,
    discountRange: [10, 20],
    affectedTypes: ["Standard", "Deluxe"],
  },
  {
    name: "Back-to-School Promo",
    startMonth: 8, startDay: 1, endMonth: 8, endDay: 31,
    discountRange: [12, 18],
    affectedTypes: ["Standard", "Deluxe"],
  },
  {
    name: "BER Months Early Bird",
    startMonth: 9, startDay: 1, endMonth: 9, endDay: 30,
    discountRange: [15, 25],
    affectedTypes: ["Standard", "Deluxe", "Suite"],
  },
  {
    name: "Halloween Treat Promo",
    startMonth: 10, startDay: 25, endMonth: 11, endDay: 2,
    discountRange: [10, 20],
    affectedTypes: ["Standard", "Deluxe"],
  },
  {
    name: "Pre-Holiday Blitz",
    startMonth: 11, startDay: 1, endMonth: 11, endDay: 30,
    discountRange: [15, 25],
    affectedTypes: ["Standard", "Deluxe", "Suite"],
  },
  {
    name: "Christmas & Year-End Sale",
    startMonth: 12, startDay: 15, endMonth: 12, endDay: 31,
    discountRange: [10, 20],
    affectedTypes: ["Standard", "Deluxe", "Suite"],
  },
]

function getHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function isDateInRange(
  month: number,
  day: number,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number
): boolean {
  const dateVal = month * 100 + day
  const startVal = startMonth * 100 + startDay
  const endVal = endMonth * 100 + endDay
  return dateVal >= startVal && dateVal <= endVal
}

function getRoomTypeCategory(roomType: string): string {
  const lower = roomType.toLowerCase()
  if (lower.includes("suite")) return "Suite"
  if (lower.includes("deluxe") || lower.includes("executive")) return "Deluxe"
  if (lower.includes("standard") || lower.includes("regular")) return "Standard"
  return roomType
}

export function getActiveDiscounts(rooms: DiscountRoom[], date?: Date): ActiveDiscount[] {
  const now = date || new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const discounts: ActiveDiscount[] = []

  for (const event of HOLIDAY_EVENTS) {
    if (isDateInRange(month, day, event.startMonth, event.startDay, event.endMonth, event.endDay)) {
      for (const room of rooms) {
        const category = getRoomTypeCategory(room.type)
        if (event.affectedTypes.includes(category)) {
          const hash = getHash(`${event.name}-${room.id}-${month}`)
          const discountPercent =
            event.discountRange[0] +
            (hash % (event.discountRange[1] - event.discountRange[0] + 1))

          const validStart = new Date(now.getFullYear(), event.startMonth - 1, event.startDay)
          const validEnd = new Date(now.getFullYear(), event.endMonth - 1, event.endDay)

          discounts.push({
            id: `${event.name}-${room.id}-${month}-${discountPercent}`,
            eventRoomTypeKey: `${event.name}-${category}`,
            roomId: room.id,
            roomType: room.type,
            roomName: room.name,
            discountPercent,
            discountedPrice: Math.round(room.price * (1 - discountPercent / 100)),
            originalPrice: room.price,
            reason: event.name,
            event: event.name,
            validFrom: validStart.toISOString().split("T")[0],
            validTo: validEnd.toISOString().split("T")[0],
            isHolidayPromo: true,
          })
        }
      }
    }
  }

  return discounts
}

export function getRoomDiscount(rooms: DiscountRoom[], roomId: string, date?: Date): ActiveDiscount | undefined {
  const discounts = getActiveDiscounts(rooms, date)
  return discounts.find((d) => d.roomId === roomId)
}

export function getUpcomingDiscounts(rooms: DiscountRoom[], date?: Date): (ActiveDiscount & { daysUntilStart: number })[] {
  const now = date || new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const currentVal = month * 100 + day
  const upcoming: (ActiveDiscount & { daysUntilStart: number })[] = []

  for (const event of HOLIDAY_EVENTS) {
    const startVal = event.startMonth * 100 + event.startDay
    if (startVal > currentVal) {
      const startDate = new Date(now.getFullYear(), event.startMonth - 1, event.startDay)
      const diffMs = startDate.getTime() - now.getTime()
      const daysUntilStart = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      for (const room of rooms) {
        const category = getRoomTypeCategory(room.type)
        if (event.affectedTypes.includes(category)) {
          const hash = getHash(`${event.name}-${room.id}-${event.startMonth}`)
          const discountPercent =
            event.discountRange[0] +
            (hash % (event.discountRange[1] - event.discountRange[0] + 1))

          upcoming.push({
            id: `up-${event.name}-${room.id}-${event.startMonth}-${discountPercent}`,
            eventRoomTypeKey: `up-${event.name}-${category}`,
            roomId: room.id,
            roomType: room.type,
            roomName: room.name,
            discountPercent,
            discountedPrice: Math.round(room.price * (1 - discountPercent / 100)),
            originalPrice: room.price,
            reason: event.name,
            event: event.name,
            validFrom: new Date(now.getFullYear(), event.startMonth - 1, event.startDay)
              .toISOString()
              .split("T")[0],
            validTo: new Date(now.getFullYear(), event.endMonth - 1, event.endDay)
              .toISOString()
              .split("T")[0],
            isHolidayPromo: true,
            daysUntilStart,
          })
        }
      }
    }
  }

  return upcoming.sort((a, b) => a.daysUntilStart - b.daysUntilStart)
}

export function getAllHolidayEvents(): HolidayEvent[] {
  return [...HOLIDAY_EVENTS]
}
