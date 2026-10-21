import { Volume2 } from 'lucide-react'
import { unlockAudio } from '@/utils/alarmSound'

interface Props {
  open: boolean
}

/**
 * アラーム音を鳴らせない状態（ブラウザの自動再生制限）のときに表示する。
 * OK のタップで音声が有効になると open が false になり閉じる。
 */
export function AudioUnlockModal({ open }: Props) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-unlock-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-6"
    >
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Volume2 size={48} className="text-amber-500 shrink-0" />
          <h2 id="audio-unlock-title" className="text-4xl font-bold text-slate-800">
            OKボタンを押してください
          </h2>
        </div>
        <p className="text-2xl text-slate-600 leading-relaxed">
          アラーム音を鳴らせるようにするため、OKボタンを押してください。
        </p>
        <button
          onClick={unlockAudio}
          className="w-full py-5 rounded-2xl bg-slate-800 text-white text-4xl font-bold active:bg-slate-600 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  )
}
