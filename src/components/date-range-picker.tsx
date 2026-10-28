import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateRangeValue {
  from: Date;
  to: Date;
}

// The one date-range picker in the app -- built reusable on purpose. Same
// Popover+Calendar shape as the existing single-date picker in
// zoho-task-page-panel.tsx, just with mode="range" instead of "single".
export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
}) {
  const [open, setOpen] = useState(false);

  function handleSelect(range: DateRange | undefined) {
    if (range?.from && range?.to) {
      onChange({ from: range.from, to: range.to });
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
          {format(value.from, "MMM d")} – {format(value.to, "MMM d, yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={{ from: value.from, to: value.to }}
          onSelect={handleSelect}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
