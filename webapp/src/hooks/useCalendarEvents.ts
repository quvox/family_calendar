import { useState, useEffect, useRef, useCallback } from 'react'
import type { ApiResponse, CalendarEvent, Member } from '@/types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? ''
const POLL_INTERVAL_MS = 5 * 60 * 1000   // 5分
const RETRY_INTERVAL_MS = 30 * 1000      // 30秒

export interface CalendarState {
  events: CalendarEvent[]
  members: Member[]
  lastFetched: string | null
  isConnected: boolean
  isLoading: boolean
}

/**
 * targetDate のイベントを取得・ポーリングする。
 * targetDate に null を渡すと取得を停止する（未使用時に余計なリクエストを出さないため）。
 */
export function useCalendarEvents(targetDate: string | null): CalendarState {
  const [state, setState] = useState<CalendarState>({
    events: [],
    members: [],
    lastFetched: null,
    isConnected: false,
    isLoading: true,
  })

  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const targetDateRef = useRef(targetDate)

  const clearRetry = () => {
    if (retryTimer.current !== null) {
      clearTimeout(retryTimer.current)
      retryTimer.current = null
    }
  }

  const fetchEvents = useCallback(async () => {
    try {
      const date = targetDateRef.current
      if (date === null) return
      const res = await fetch(`${API_BASE}/api/events?date=${date}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ApiResponse = await res.json()
      // 取得中に対象日が切り替わった場合は古い結果を捨てる
      if (targetDateRef.current !== date) return

      clearRetry()
      setState(prev => ({
        ...prev,
        events: data.events,
        members: data.members ?? [],
        lastFetched: data.last_fetched,
        isConnected: true,
        isLoading: false,
      }))
    } catch {
      setState(prev => ({ ...prev, isConnected: false, isLoading: false }))
      if (retryTimer.current === null) {
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null
          fetchEvents()
        }, RETRY_INTERVAL_MS)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // targetDate が変わったら即座に再取得
  useEffect(() => {
    targetDateRef.current = targetDate
    clearRetry()
    if (targetDate === null) {
      setState(prev => ({ ...prev, isLoading: false, events: [] }))
      return
    }
    setState(prev => ({ ...prev, isLoading: true, events: [] }))
    fetchEvents()
  }, [targetDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // 5分ポーリング
  useEffect(() => {
    pollTimer.current = setInterval(fetchEvents, POLL_INTERVAL_MS)
    return () => {
      if (pollTimer.current !== null) clearInterval(pollTimer.current)
      clearRetry()
    }
  }, [fetchEvents])

  return state
}
