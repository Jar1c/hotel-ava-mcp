import { Calendar } from "lucide-react"

interface DateInputProps {
  value?: string
  onClick?: () => void
  placeholder?: string
  ref?: React.Ref<HTMLButtonElement>
}

export default function DateInput({ value, onClick, placeholder, ref }: DateInputProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      ref={ref}
      className="w-full flex items-center gap-sm px-base py-2.5 rounded-[12px] border border-hairline hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-left bg-white"
    >
      <Calendar className="h-4 w-4 text-muted shrink-0" />
      <span className="typo-body-sm text-ink truncate">
        {value || placeholder || "Select date"}
      </span>
    </button>
  )
}
