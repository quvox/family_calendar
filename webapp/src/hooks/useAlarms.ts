import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { parseISO } from 'date-fns'
import type { CalendarEvent } from '@/types'
import {
  isAudioReady,
  subscribeAudioState,
  unlockAudio,
  startAlarmSound,
  stopAlarmSound,
} from '@/utils/alarmSound'

const LEAD_MS = 10 * 60 * 1000          // 予定開始の10分前に鳴らす
const RING_MS = 15 * 60 * 1000          // OK を押さなければ15分で自動停止
const CHECK_INTERVAL_MS = 5 * 1000
const FIRED_STORAGE_KEY = 'family-calendar:fired-alarms'
const FIRED_RETENTION_MS = 2 * 24 * 60 * 60 * 1000

export interface ActiveAlarm {
  key: string
  event: CalendarEvent
  firedAt: number
}

// 繰り返しイベントは UID が同じなので開始時刻と組み合わせて識別する
function alarmKey(event: CalendarEvent): string {
  return `${event.id}@${event.start}`
}

// 鳴らし済みアラームを localStorage に保存し、リロードで再度鳴らないようにする
function loadFired(): Map<string, number> {
  try {
    const raw = localStorage.getItem(FIRED_STORAGE_KEY)
    if (raw) return new Map(Object.entries(JSON.parse(raw) as Record<string, number>))
  } catch {
    // ストレージが使えない環境ではメモリ上のみで管理する
  }
  return new Map()
}

function saveFired(fired: Map<string, number>): void {
  try {
    localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(Object.fromEntries(fired)))
  } catch {
    // 無視
  }
}

export interface AlarmState {
  activeAlarms: ActiveAlarm[]
  dismiss: () => void
  audioReady: boolean
}

/** 今日のイベントのうち alarm 指定のものを開始10分前に鳴らす */
export function useAlarms(todayEvents: CalendarEvent[]): AlarmState {
  const [activeAlarms, setActiveAlarms] = useState<ActiveAlarm[]>([])
  const firedRef = useRef<Map<string, number> | null>(null)
  const eventsRef = useRef(todayEvents)
  eventsRef.current = todayEvents

  const audioReady = useSyncExternalStore(subscribeAudioState, isAudioReady)

  // 画面のどこかをタップしたら音声を有効化する（自動再生ポリシー対策）
  // タッチ操作では pointerdown ではなく pointerup / touchend がユーザー操作として扱われる
  useEffect(() => {
    const types = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const
    types.forEach(t => window.addEventListener(t, unlockAudio, true))
    return () => types.forEach(t => window.removeEventListener(t, unlockAudio, true))
  }, [])

  useEffect(() => {
    const check = () => {
      const now = Date.now()
      if (firedRef.current === null) firedRef.current = loadFired()
      const fired = firedRef.current
      let firedChanged = false

      for (const [key, ts] of fired) {
        if (now - ts > FIRED_RETENTION_MS) {
          fired.delete(key)
          firedChanged = true
        }
      }

      const newAlarms: ActiveAlarm[] = []
      for (const event of eventsRef.current) {
        if (!event.alarm || event.allDay) continue
        const key = alarmKey(event)
        if (fired.has(key)) continue
        const alarmAt = parseISO(event.start).getTime() - LEAD_MS
        // 鳴動時刻〜その15分後までの間なら鳴らす（予定を直前に追加した場合も鳴る）
        if (now >= alarmAt && now < alarmAt + RING_MS) {
          fired.set(key, now)
          firedChanged = true
          newAlarms.push({ key, event, firedAt: now })
        }
      }
      if (firedChanged) saveFired(fired)

      setActiveAlarms(prev => {
        const kept = prev.filter(a => now < a.firedAt + RING_MS)
        if (newAlarms.length === 0 && kept.length === prev.length) return prev
        return [...kept, ...newAlarms]
      })
    }

    check()
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (activeAlarms.length > 0) startAlarmSound()
    else stopAlarmSound()
  }, [activeAlarms.length])

  useEffect(() => stopAlarmSound, [])

  const dismiss = useCallback(() => setActiveAlarms([]), [])

  return { activeAlarms, dismiss, audioReady }
}
