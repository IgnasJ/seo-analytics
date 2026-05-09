"use client"

const DATE_RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "1m", label: "1 month" },
  { key: "90d", label: "90 days" },
  { key: "1y", label: "1 year" },
] as const

export type DateRangeKey = (typeof DATE_RANGES)[number]["key"]

interface DateRangePickerProps {
  selected: DateRangeKey
  onChange: (key: DateRangeKey) => void
}

export function DateRangePicker({ selected, onChange }: DateRangePickerProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {DATE_RANGES.map((range) => (
        <button
          key={range.key}
          onClick={() => onChange(range.key)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            selected === range.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}
