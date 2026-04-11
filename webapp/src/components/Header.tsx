import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export function Header() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateStr = format(now, 'M月d日（eee）', { locale: ja })
  const timeStr = format(now, 'HH:mm:ss')

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
      <span className="text-4xl font-bold text-slate-800 tracking-wide">
        {dateStr}
      </span>
      <span className="text-4xl font-mono font-semibold text-slate-600 tabular-nums">
        {timeStr}
      </span>
    </header>
  )
}
