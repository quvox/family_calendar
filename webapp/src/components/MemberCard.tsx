import { format, parseISO } from 'date-fns'
import type { CalendarEvent } from '@/types'

interface Props {
  member: string
  color: string
  events: CalendarEvent[]
}

function formatTime(isoStr: string): string {
  return format(parseISO(isoStr), 'HH:mm')
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function MemberCard({ member, color, events }: Props) {
  const allDayEvents = events.filter(e => e.allDay)
  const timedEvents = events.filter(e => !e.allDay)
  const sorted = [...allDayEvents, ...timedEvents]

  return (
    <div className="flex flex-col rounded-xl overflow-hidden shadow-sm border border-slate-200 min-w-0">
      {/* ヘッダー：メンバー名 */}
      <div className="px-4 py-3 shrink-0" style={{ backgroundColor: color }}>
        <span className="text-xl font-bold text-white">{member}</span>
      </div>

      {/* イベント一覧 */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2"
        style={{ backgroundColor: hexToRgba(color, 0.08) }}
      >
        {sorted.length === 0 ? (
          <p className="text-sm" style={{ color }}>予定なし</p>
        ) : (
          sorted.map(event => (
            <div key={event.id} className="flex items-baseline gap-3 overflow-hidden">
              <span
                className="shrink-0 text-lg font-semibold tabular-nums"
                style={{ color }}
              >
                {event.allDay ? '終日' : formatTime(event.start)}
              </span>
              <span className="text-xl font-semibold text-slate-900 truncate leading-snug">
                {event.title}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
