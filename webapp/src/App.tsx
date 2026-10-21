import { useState, useEffect } from 'react'
import { format, addDays } from 'date-fns'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { useAlarms } from '@/hooks/useAlarms'
import { Header } from '@/components/Header'
import { MemberCard } from '@/components/MemberCard'
import { EmptyState } from '@/components/EmptyState'
import { StatusBar } from '@/components/StatusBar'
import { AlarmModal } from '@/components/AlarmModal'
import { AudioUnlockModal } from '@/components/AudioUnlockModal'
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
  const [isViewingTomorrow, setIsViewingTomorrow] = useState(false)
  const [todayStr, setTodayStr] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  // 日付変更を検知したら今日ビューに戻す
  useEffect(() => {
    const timer = setInterval(() => {
      const newToday = format(new Date(), 'yyyy-MM-dd')
      if (newToday !== todayStr) {
        setTodayStr(newToday)
        setIsViewingTomorrow(false)
      }
    }, 60 * 1000)
    return () => clearInterval(timer)
  }, [todayStr])

  const tomorrowStr = format(addDays(new Date(todayStr), 1), 'yyyy-MM-dd')
  const targetDate = isViewingTomorrow ? tomorrowStr : todayStr

  // 表示用 Date オブジェクト（ローカル時刻 00:00 として解釈）
  const displayDate = new Date(`${targetDate}T00:00:00`)

  // アラーム判定のため、明日を表示中も今日の予定は常に取得しておく
  const today = useCalendarEvents(todayStr)
  const tomorrow = useCalendarEvents(isViewingTomorrow ? tomorrowStr : null)
  const { events, members, lastFetched, isConnected, isLoading } = isViewingTomorrow ? tomorrow : today

  const { activeAlarms, dismiss, audioReady } = useAlarms(today.events)

  const cards = buildCards(events, members)
  const hasEvents = events.length > 0

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900">
      <Header
        displayDate={displayDate}
        isViewingTomorrow={isViewingTomorrow}
        onToggle={() => setIsViewingTomorrow(v => !v)}
      />

      <main className="flex-1 overflow-hidden px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p className="text-2xl animate-pulse">読み込み中…</p>
          </div>
        ) : hasEvents ? (
          <div className="grid portrait:grid-cols-2 landscape:grid-cols-3 auto-rows-fr gap-4 h-full">
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

      {/* アラーム表示中はそちらを優先する（アラームの OK タップでも音声は有効になる） */}
      <AudioUnlockModal open={!audioReady && activeAlarms.length === 0} />
      <AlarmModal alarms={activeAlarms} onDismiss={dismiss} />
    </div>
  )
}
