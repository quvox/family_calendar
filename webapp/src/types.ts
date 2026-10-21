export interface CalendarEvent {
  id: string
  title: string
  member: string | null
  color: string
  start: string
  end: string
  allDay: boolean
  alarm?: boolean
  location?: string | null
  description?: string | null
}

export interface Member {
  name: string
  color: string
}

export interface ApiResponse {
  date: string
  last_fetched: string | null
  members: Member[]
  events: CalendarEvent[]
}
