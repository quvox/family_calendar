import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import type { ApiResponse, CalendarEvent, Member } from '@/types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? ''
const POLL_INTERVAL_MS = 5 * 60 * 1000   // 5分
const RETRY_INTERVAL_MS = 30 * 1000      // 30秒
const DATE_CHECK_INTERVAL_MS = 60 * 1000 // 1分

export interface CalendarState {
  events: CalendarEvent[]
  members: Member[]
  lastFetched: string | null
  isConnected: boolean
  isLoading: boolean
  currentDate: string // YYYY-MM-DD
}

export function useCalendarEvents(): CalendarState {
  const [state, setState] = useState<CalendarState>({
    events: [],
    members: [],
    lastFetched: null,
    isConnected: false,
    isLoading: true,
    currentDate: format(new Date(), 'yyyy-MM-dd'),
  })

  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearRetry = () => {
    if (retryTimer.current !== null) {
      clearTimeout(retryTimer.current)
      retryTimer.current = null
    }
  }

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/events/today`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ApiResponse = await res.json()

      clearRetry()
      setState(prev => ({
        ...prev,
        events: data.events,
        members: data.members ?? [],
        lastFetched: data.last_fetched,
        isConnected: true,
        isLoading: false,
        currentDate: data.date,
      }))
    } catch {
      setState(prev => ({ ...prev, isConnected: false, isLoading: false }))
      // 未スケジュールならリトライをセット
      if (retryTimer.current === null) {
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null
          fetchEvents()
        }, RETRY_INTERVAL_MS)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchEvents()

    // 5分ポーリング
    pollTimer.current = setInterval(fetchEvents, POLL_INTERVAL_MS)

    // 日付変更検知（1分ごと）
    const dateCheckTimer = setInterval(() => {
      const today = format(new Date(), 'yyyy-MM-dd')
      setState(prev => {
        if (prev.currentDate !== today) {
          fetchEvents()
        }
        return prev
      })
    }, DATE_CHECK_INTERVAL_MS)

    return () => {
      if (pollTimer.current !== null) clearInterval(pollTimer.current)
      clearRetry()
      clearInterval(dateCheckTimer)
    }
  }, [fetchEvents])

  return state
}
