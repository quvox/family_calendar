import { MapPin } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { CalendarEvent } from '@/types'

interface Props {
  event: CalendarEvent
}

function formatTime(isoStr: string): string {
  return format(parseISO(isoStr), 'HH:mm')
}

export function EventCard({ event }: Props) {
  const timeLabel = event.allDay
    ? '終日'
    : `${formatTime(event.start)} – ${formatTime(event.end)}`

  return (
    <div className="bg-white rounded-xl px-5 py-4 border border-slate-200 shadow-sm">
      {/* 1行目：メンバー */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="shrink-0 w-3 h-3 rounded-full"
          style={{ backgroundColor: event.color }}
        />
        <span className="text-xl font-medium text-slate-500 truncate">
          {event.member ?? '未設定'}
        </span>
      </div>

      {/* 2行目：時刻（大きく目立つ） */}
      <p
        className="text-2xl font-bold tabular-nums mt-1"
        style={{ color: event.allDay ? '#94a3b8' : event.color }}
      >
        {timeLabel}
      </p>

      {/* 3行目：タイトル */}
      <p className="text-2xl font-semibold text-slate-900 mt-1 leading-snug">
        {event.title}
      </p>

      {/* 4行目：場所（あれば） */}
      {event.location && (
        <p className="flex items-center gap-1 mt-1.5 text-sm text-slate-500">
          <MapPin size={13} className="shrink-0" />
          {event.location}
        </p>
      )}
    </div>
  )
}
