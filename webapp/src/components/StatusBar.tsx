import { format, parseISO } from 'date-fns'

interface Props {
  isConnected: boolean
  lastFetched: string | null
  isLoading: boolean
}

export function StatusBar({ isConnected, lastFetched, isLoading }: Props) {
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
      {updatedAt && (
        <span className="text-sm text-slate-400">最終更新: {updatedAt}</span>
      )}
    </footer>
  )
}
