import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LEAVE_TYPE_COLORS,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPES,
  type LeaveRequest,
  type LeaveType,
} from "@/lib/api/types";

interface LeaveCalendarProps {
  leaves: LeaveRequest[];
  /** If true, shows employee names on leave blocks */
  showEmployee?: boolean;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isDateInRange(date: Date, start: Date, end: Date) {
  const d = date.setHours(0, 0, 0, 0);
  const s = new Date(start).setHours(0, 0, 0, 0);
  const e = new Date(end).setHours(0, 0, 0, 0);
  return d >= s && d <= e;
}

function getLeavesForDay(date: Date, leaves: LeaveRequest[]): LeaveRequest[] {
  return leaves.filter((l) =>
    l.status === "APPROVED" &&
    isDateInRange(date, new Date(l.startDate), new Date(l.endDate)),
  );
}

export function LeaveCalendar({ leaves, showEmployee = false }: LeaveCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [tooltip, setTooltip] = useState<{ x: number; y: number; leaves: LeaveRequest[] } | null>(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Cells: null = empty padding, number = day of month
  const cells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad end to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={prevMonth} className="size-8">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <Button variant="outline" size="icon" onClick={nextMonth} className="size-8">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border-subtle overflow-hidden bg-panel">
        {/* Header row */}
        <div className="grid grid-cols-7 border-b border-border-subtle">
          {DAYS_OF_WEEK.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[11px] font-medium text-text-dim uppercase tracking-widest"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-border-subtle border-b border-border-subtle last:border-b-0">
            {week.map((day, di) => {
              if (!day) {
                return <div key={di} className="min-h-[72px] bg-panel-elevated/30" />;
              }
              const cellDate = new Date(viewYear, viewMonth, day);
              const isToday = isSameDay(cellDate, today);
              const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
              const dayLeaves = getLeavesForDay(cellDate, leaves);

              return (
                <div
                  key={di}
                  className={`min-h-[72px] p-1.5 space-y-0.5 transition-colors ${
                    isWeekend ? "bg-panel-elevated/40" : "bg-panel"
                  } hover:bg-accent/30 cursor-default relative`}
                  onMouseEnter={(e) => {
                    if (dayLeaves.length > 0) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ x: rect.left, y: rect.bottom, leaves: dayLeaves });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Day number */}
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : isWeekend
                      ? "text-text-dim"
                      : "text-foreground"
                  }`}>
                    {day}
                  </div>

                  {/* Leave blocks */}
                  {dayLeaves.slice(0, 3).map((leave) => (
                    <div
                      key={leave.id}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white truncate"
                      style={{ backgroundColor: LEAVE_TYPE_COLORS[leave.type] + "d0" }}
                    >
                      {showEmployee
                        ? `${leave.user.firstName} ${leave.user.lastName[0]}.`
                        : LEAVE_TYPE_LABELS[leave.type].split(" ")[0]}
                    </div>
                  ))}
                  {dayLeaves.length > 3 && (
                    <div className="text-[10px] text-text-dim px-1">+{dayLeaves.length - 3} more</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {LEAVE_TYPES.map((t) => (
          <div key={t} className="flex items-center gap-1.5 text-xs text-text-dim">
            <span
              className="size-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: LEAVE_TYPE_COLORS[t] }}
            />
            {LEAVE_TYPE_LABELS[t]}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-text-dim ml-auto">
          <span className="size-2.5 rounded-sm bg-panel-elevated/40 border border-border-subtle" />
          Weekend
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-popover border border-border-subtle rounded-lg shadow-xl p-2.5 min-w-[180px] space-y-1.5 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y + 4 }}
        >
          {tooltip.leaves.map((l) => (
            <div key={l.id} className="flex items-start gap-2">
              <span
                className="size-2 rounded-full mt-1 shrink-0"
                style={{ backgroundColor: LEAVE_TYPE_COLORS[l.type] }}
              />
              <div>
                <p className="text-xs font-medium">
                  {l.user.firstName} {l.user.lastName}
                </p>
                <p className="text-[10px] text-text-dim">{LEAVE_TYPE_LABELS[l.type]}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
