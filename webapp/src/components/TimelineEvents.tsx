import { EventCard } from './EventCard'
import type { CalendarEvent } from '@/types'

interface Props {
  events: CalendarEvent[]
}

export function TimelineEvents({ events }: Props) {
  if (events.length === 0) return null

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
        時間指定
      </h2>
      <div className="flex flex-col gap-3">
        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  )
}
