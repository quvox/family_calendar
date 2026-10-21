// Web Audio API でアラーム音を生成する（音声ファイル不要）
//
// ブラウザの自動再生ポリシーにより、AudioContext はユーザー操作（タップ等）の後でないと
// 音を出せない（state が 'suspended' のまま）。そのため画面タップ時に unlockAudio() を呼んで
// resume しておき、アラーム時刻にはそのまま鳴らせる状態にしておく。

const BEEP_FREQ_HZ = 880
const BEEP_SEC = 0.12
const BEEP_GAP_SEC = 0.08
const BEEPS_PER_CYCLE = 4
const CYCLE_MS = 1500

let ctx: AudioContext | null = null
let cycleTimer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function getContext(): AudioContext | null {
  if (ctx) return ctx
  try {
    // iOS Safari で消音スイッチ ON でも鳴るようにする（Safari 16.4+、未対応ブラウザは無視）
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'playback'

    ctx = new AudioContext()
    ctx.onstatechange = () => listeners.forEach(fn => fn())
  } catch {
    ctx = null
  }
  return ctx
}

/** 音を鳴らせる状態か（ユーザー操作により AudioContext が running になっているか） */
export function isAudioReady(): boolean {
  return getContext()?.state === 'running'
}

/** isAudioReady() の変化を購読する */
export function subscribeAudioState(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** ユーザー操作のイベントハンドラ内から呼ぶこと */
export function unlockAudio(): void {
  const c = getContext()
  if (c && c.state !== 'running') {
    c.resume().catch(() => {})
  }
}

function playCycle(c: AudioContext): void {
  const t0 = c.currentTime + 0.01
  for (let i = 0; i < BEEPS_PER_CYCLE; i++) {
    const start = t0 + i * (BEEP_SEC + BEEP_GAP_SEC)
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'square'
    osc.frequency.value = BEEP_FREQ_HZ
    // クリックノイズを避けるため短いエンベロープをかける
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.3, start + 0.01)
    gain.gain.setValueAtTime(0.3, start + BEEP_SEC - 0.01)
    gain.gain.linearRampToValueAtTime(0, start + BEEP_SEC)
    osc.connect(gain).connect(c.destination)
    osc.start(start)
    osc.stop(start + BEEP_SEC)
  }
}

export function startAlarmSound(): void {
  if (cycleTimer !== null) return
  const tick = () => {
    const c = getContext()
    if (c?.state === 'running') playCycle(c)
  }
  tick()
  cycleTimer = setInterval(tick, CYCLE_MS)
}

export function stopAlarmSound(): void {
  if (cycleTimer !== null) {
    clearInterval(cycleTimer)
    cycleTimer = null
  }
}
