// HTMLAudioElement でアラーム音を鳴らす（音声ファイルは実行時に WAV を生成するため不要）
//
// Web Audio API は iOS の消音モードでミュートされるため、<audio> 要素で再生する。
// ブラウザの自動再生ポリシーにより、ユーザー操作なしでは play() が拒否される。
// iOS では一度ユーザー操作の中で play() した要素は以後プログラムから再生できるため、
// 画面タップ時に unlockAudio() で無音再生して「準備済み」にしておく。

const SAMPLE_RATE = 22050
const BEEP_FREQ_HZ = 880
const BEEP_SEC = 0.12
const BEEP_GAP_SEC = 0.08
const BEEPS_PER_CYCLE = 4
const CYCLE_SEC = 1.5
const AMPLITUDE = 0.3
const RAMP_SEC = 0.01

let audio: HTMLAudioElement | null = null
let unlocked = false
let unlocking = false
let ringing = false
const listeners = new Set<() => void>()

/** ビープ4回＋無音を1サイクルとする 16bit モノラル WAV を生成する */
function createBeepWavUrl(): string {
  const numSamples = Math.floor(SAMPLE_RATE * CYCLE_SEC)
  const buf = new ArrayBuffer(44 + numSamples * 2)
  const view = new DataView(buf)
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + numSamples * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)            // fmt チャンクサイズ
  view.setUint16(20, 1, true)             // PCM
  view.setUint16(22, 1, true)             // モノラル
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, numSamples * 2, true)

  const period = BEEP_SEC + BEEP_GAP_SEC
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE
    const idx = Math.floor(t / period)
    const local = t - idx * period
    let v = 0
    if (idx < BEEPS_PER_CYCLE && local < BEEP_SEC) {
      // クリックノイズを避けるため立ち上がり・立ち下がりにランプをかける
      const env = Math.min(1, local / RAMP_SEC, (BEEP_SEC - local) / RAMP_SEC)
      const square = Math.sin(2 * Math.PI * BEEP_FREQ_HZ * t) >= 0 ? 1 : -1
      v = square * AMPLITUDE * env
    }
    view.setInt16(44 + i * 2, Math.round(v * 0x7fff), true)
  }

  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

function getAudio(): HTMLAudioElement {
  if (audio) return audio
  // iOS Safari で消音スイッチ ON でも鳴るようにする（Safari 16.4+、未対応ブラウザは無視）
  const nav = navigator as Navigator & { audioSession?: { type: string } }
  if (nav.audioSession) nav.audioSession.type = 'playback'

  audio = new Audio(createBeepWavUrl())
  audio.loop = true
  audio.preload = 'auto'
  return audio
}

function notify(): void {
  listeners.forEach(fn => fn())
}

/** 音を鳴らせる状態か（ユーザー操作で一度再生済みか） */
export function isAudioReady(): boolean {
  return unlocked
}

/** isAudioReady() の変化を購読する */
export function subscribeAudioState(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** ユーザー操作のイベントハンドラ内から呼ぶこと */
export function unlockAudio(): void {
  if (unlocked || unlocking) return
  const a = getAudio()
  unlocking = true
  // 鳴動中でなければ無音で再生してすぐ止める
  a.muted = !ringing
  a.play()
    .then(() => {
      unlocked = true
      if (!ringing) {
        a.pause()
        a.currentTime = 0
      }
      a.muted = false
      notify()
    })
    .catch(() => {
      a.muted = false
    })
    .finally(() => {
      unlocking = false
    })
}

export function startAlarmSound(): void {
  if (ringing) return
  ringing = true
  const a = getAudio()
  a.muted = false
  a.currentTime = 0
  // 未準備の場合は拒否されるが、次のタップ（unlockAudio）で鳴り始める
  a.play()
    .then(() => {
      if (!unlocked) {
        unlocked = true
        notify()
      }
    })
    .catch(() => {})
}

export function stopAlarmSound(): void {
  ringing = false
  if (audio) {
    audio.pause()
    audio.currentTime = 0
  }
}
