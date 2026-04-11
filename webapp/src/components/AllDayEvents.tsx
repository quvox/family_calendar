import { EventCard } from './EventCard'
import type { CalendarEvent } from '@/types'

interface Props {
  events: CalendarEvent[]
}

export function AllDayEvents({ events }: Props) {
  if (events.length === 0) return null

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
        終日
      </h2>
      <div className="flex flex-col gap-3">
        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  )
}
