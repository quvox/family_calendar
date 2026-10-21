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

/** sample(t) で波形（-1〜1）を与えて 16bit モノラル WAV を生成する */
function createWavUrl(seconds: number, sample: (t: number) => number): string {
  const numSamples = Math.floor(SAMPLE_RATE * seconds)
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

  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, Math.round(sample(i / SAMPLE_RATE) * 0x7fff), true)
  }

  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

/** ビープ4回＋無音を1サイクルとする波形 */
function beepSample(t: number): number {
  const period = BEEP_SEC + BEEP_GAP_SEC
  const idx = Math.floor(t / period)
  const local = t - idx * period
  if (idx >= BEEPS_PER_CYCLE || local >= BEEP_SEC) return 0
  // クリックノイズを避けるため立ち上がり・立ち下がりにランプをかける
  const env = Math.min(1, local / RAMP_SEC, (BEEP_SEC - local) / RAMP_SEC)
  const square = Math.sin(2 * Math.PI * BEEP_FREQ_HZ * t) >= 0 ? 1 : -1
  return square * AMPLITUDE * env
}

function getAudio(): HTMLAudioElement {
  if (audio) return audio
  // iOS Safari で消音スイッチ ON でも鳴るようにする（Safari 16.4+、未対応ブラウザは無視）
  const nav = navigator as Navigator & { audioSession?: { type: string } }
  if (nav.audioSession) nav.audioSession.type = 'playback'

  audio = new Audio(createWavUrl(CYCLE_SEC, beepSample))
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

function setUnlocked(value: boolean): void {
  if (unlocked === value) return
  unlocked = value
  notify()
}

/**
 * ユーザー操作なしで音を出せるか、無音の音声を再生して確かめる。
 * 自動再生が許可されている環境（Chrome で過去に操作したサイト等）ではタップ不要になる。
 */
export function probeAutoplay(): void {
  if (unlocked) return
  getAudio()  // audioSession の設定を先に済ませる
  const probe = new Audio(createWavUrl(0.1, () => 0))
  probe.play()
    .then(() => setUnlocked(true))
    .catch(() => {})
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
      if (!ringing) {
        a.pause()
        a.currentTime = 0
      }
      a.muted = false
      setUnlocked(true)
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
    .then(() => setUnlocked(true))
    // 再生を拒否された場合は未準備に戻し、OK ボタンのモーダルで再度有効化してもらう
    .catch(() => setUnlocked(false))
}

export function stopAlarmSound(): void {
  ringing = false
  if (audio) {
    audio.pause()
    audio.currentTime = 0
  }
}
