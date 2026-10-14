import AvailabilityCalendar from "@/components/admin/AvailabilityCalendar"

export default function Calendar() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Calendar</h1>
        <p className="text-sm text-muted">View room availability and booking schedule.</p>
      </div>

      <AvailabilityCalendar />
    </div>
  )
}
