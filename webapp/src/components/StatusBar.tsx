import { VolumeX } from 'lucide-react'
import { format, parseISO } from 'date-fns'

interface Props {
  isConnected: boolean
  lastFetched: string | null
  isLoading: boolean
  audioReady: boolean
}

export function StatusBar({ isConnected, lastFetched, isLoading, audioReady }: Props) {
  const updatedAt = lastFetched
    ? format(parseISO(lastFetched), 'HH:mm')
    : null

  return (
    <footer className="flex items-center justify-between px-6 py-3 bg-white border-t border-slate-200">
      <div className="flex items-center gap-2">
        {isLoading ? (
          <>
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-sm text-slate-500">読み込み中…</span>
          </>
        ) : isConnected ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-slate-500">接続中</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-slate-500">サーバーに接続できません — 再接続中…</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        {!audioReady && (
          <span className="flex items-center gap-1 text-sm text-amber-600">
            <VolumeX size={14} className="shrink-0" />
            画面をタップするとアラーム音が有効になります
          </span>
        )}
        {updatedAt && (
          <span className="text-sm text-slate-400">最終更新: {updatedAt}</span>
        )}
      </div>
    </footer>
  )
}
