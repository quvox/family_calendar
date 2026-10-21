import { BellRing } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { ActiveAlarm } from '@/hooks/useAlarms'

interface Props {
  alarms: ActiveAlarm[]
  onDismiss: () => void
}

export function AlarmModal({ alarms, onDismiss }: Props) {
  if (alarms.length === 0) return null

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alarm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-6"
    >
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <BellRing size={48} className="text-red-500 shrink-0 animate-bounce" />
          <h2 id="alarm-title" className="text-4xl font-bold text-slate-800">
            まもなく予定の時間です
          </h2>
        </div>

        <ul className="flex flex-col gap-3">
          {alarms.map(({ key, event }) => (
            <li
              key={key}
              className="rounded-xl border border-slate-200 px-5 py-4 border-l-8"
              style={{ borderLeftColor: event.color }}
            >
              <p className="text-xl font-medium text-slate-500">{event.member ?? '全員'}</p>
              <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: event.color }}>
                {format(parseISO(event.start), 'HH:mm')}
              </p>
              <p className="text-3xl font-semibold text-slate-900 mt-1 leading-snug">
                {event.title}
              </p>
            </li>
          ))}
        </ul>

        <button
          onClick={onDismiss}
          autoFocus
          className="w-full py-5 rounded-2xl bg-slate-800 text-white text-4xl font-bold active:bg-slate-600 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  )
}
