/**
 * スマホの振動（Haptics）。
 * - Android Chrome など: Vibration API（navigator.vibrate）
 * - iOS Safari: Vibration API が無いので、switch 型チェックボックスを切り替えたときに
 *   出る触覚フィードバックを利用する（iOS 18 以降。効かない端末では何も起きない）
 */
type Pattern = number | number[]

let enabled = true
/** 演出用の振動パターンが鳴り終わる時刻。それまでは鼓動の振動で上書きしない */
let busyUntil = 0

function total(pattern: Pattern): number {
  return typeof pattern === 'number' ? pattern : pattern.reduce((a, b) => a + b, 0)
}

const hasVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1))

function iosTick() {
  try {
    const label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.display = 'none'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    label.appendChild(input)
    document.head.appendChild(label)
    label.click()
    document.head.removeChild(label)
  } catch {
    /* ignore */
  }
}

export const haptics = {
  /** 'vibrate' = Vibration API、'ios' = iOS の触覚フォールバック、'none' = 非対応 */
  support(): 'vibrate' | 'ios' | 'none' {
    if (hasVibrate) return 'vibrate'
    return isIOS ? 'ios' : 'none'
  },

  setEnabled(v: boolean) {
    enabled = v
    if (!v && hasVibrate) {
      try {
        navigator.vibrate(0)
      } catch {
        /* ignore */
      }
    }
  },

  isEnabled() {
    return enabled
  },

  /** 心拍用の弱い振動。カードを出した瞬間や決着の振動が鳴っている間は割り込まない */
  beat(pattern: Pattern) {
    if (performance.now() < busyUntil) return
    this.emit(pattern)
  },

  /** 演出用の振動。pattern は navigator.vibrate と同じ（振動 ms, 休止 ms, 振動 ms, ...） */
  pulse(pattern: Pattern) {
    busyUntil = performance.now() + total(pattern) + 40
    this.emit(pattern)
  },

  emit(pattern: Pattern) {
    if (!enabled) return
    if (hasVibrate) {
      try {
        navigator.vibrate(pattern)
      } catch {
        /* ignore */
      }
      return
    }
    if (!isIOS) return
    // iOS は強さも長さも指定できないので、各「振動」の開始時刻に 1 回ずつ tick を打つ
    const list = typeof pattern === 'number' ? [pattern] : pattern
    let t = 0
    list.forEach((ms, i) => {
      if (i % 2 === 0) {
        if (t === 0) iosTick()
        else window.setTimeout(iosTick, t)
      }
      t += ms
    })
  },
}
