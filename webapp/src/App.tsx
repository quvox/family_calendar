import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { Header } from '@/components/Header'
import { MemberCard } from '@/components/MemberCard'
import { EmptyState } from '@/components/EmptyState'
import { StatusBar } from '@/components/StatusBar'
import type { CalendarEvent, Member } from '@/types'

const UNASSIGNED_LABEL = '全員'
const UNASSIGNED_COLOR = '#94a3b8'

interface CardEntry {
  member: string
  color: string
  events: CalendarEvent[]
}

function buildCards(events: CalendarEvent[], members: Member[]): CardEntry[] {
  // イベントをメンバー名でグループ化
  const map = new Map<string, { color: string; events: CalendarEvent[] }>()
  for (const event of events) {
    const key = event.member ?? UNASSIGNED_LABEL
    const color = event.member ? event.color : UNASSIGNED_COLOR
    if (!map.has(key)) map.set(key, { color, events: [] })
    map.get(key)!.events.push(event)
  }

  // コンフィグ順（今日予定があるメンバーのみ）
  const ordered: CardEntry[] = []
  for (const m of members) {
    const entry = map.get(m.name)
    if (entry) ordered.push({ member: m.name, color: m.color, events: entry.events })
  }

  // 「全員」は必ず末尾
  const unassigned = map.get(UNASSIGNED_LABEL)
  if (unassigned) {
    ordered.push({ member: UNASSIGNED_LABEL, color: UNASSIGNED_COLOR, events: unassigned.events })
  }

  return ordered
}

export function App() {
  const { events, members, lastFetched, isConnected, isLoading } = useCalendarEvents()

  const cards = buildCards(events, members)
  const hasEvents = events.length > 0

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900">
      <Header />

      <main className="flex-1 overflow-hidden px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p className="text-2xl animate-pulse">読み込み中…</p>
          </div>
        ) : hasEvents ? (
          <div className="grid grid-cols-3 auto-rows-fr gap-4 h-full">
            {cards.map(({ member, color, events: memberEvents }) => (
              <MemberCard
                key={member}
                member={member}
                color={color}
                events={memberEvents}
              />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </main>

      <StatusBar
        isConnected={isConnected}
        lastFetched={lastFetched}
        isLoading={isLoading}
      />
    </div>
  )
}
