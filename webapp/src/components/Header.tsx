import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface Props {
  displayDate: Date
  isViewingTomorrow: boolean
  onToggle: () => void
}

export function Header({ displayDate, isViewingTomorrow, onToggle }: Props) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateStr = format(displayDate, 'M月d日（eee）', { locale: ja })
  const timeStr = format(now, 'HH:mm:ss')

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
      <div className="flex items-center gap-4">
        <span className="text-4xl font-bold text-slate-800 tracking-wide">
          {dateStr}
        </span>
        <button
          onClick={onToggle}
          className="px-4 py-2 rounded-lg text-xl font-semibold border-2 border-slate-400 text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          {isViewingTomorrow ? '今日の予定' : '明日の予定'}
        </button>
      </div>
      <span className="text-4xl font-mono font-semibold text-slate-600 tabular-nums">
        {timeStr}
      </span>
    </header>
  )
}
