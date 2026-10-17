/**
 * Web Audio API による心拍音＆効果音のシンセ生成。外部音源ファイルは不要。
 * iOS Safari / Chrome の自動再生制限に対応するため、ユーザー操作時に unlock() を呼ぶ。
 */
export class HeartbeatEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bpm = 60
  private running = false
  private muted = false
  private nextBeatTime = 0
  private timer: number | null = null

  /** ユーザー操作のタイミングで AudioContext を確実に生成・再開する */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 1
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        /* ignore */
      }
    }
    // iOS 向け: 無音バッファを 1 回鳴らしてオーディオ経路を開く
    try {
      const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.connect(this.ctx.destination)
      src.start(0)
    } catch {
      /* ignore */
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02)
    }
  }

  isMuted() {
    return this.muted
  }

  setBpm(bpm: number) {
    this.bpm = Math.max(30, Math.min(220, bpm))
  }

  getBpm() {
    return this.bpm
  }

  start() {
    if (this.running || !this.ctx) return
    this.running = true
    this.nextBeatTime = this.ctx.currentTime + 0.05
    this.schedule()
  }

  stop() {
    this.running = false
    if (this.timer !== null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
  }

  private schedule = () => {
    if (!this.running || !this.ctx) return
    const lookahead = 0.25
    while (this.nextBeatTime < this.ctx.currentTime + lookahead) {
      this.playHeartbeat(this.nextBeatTime)
      this.nextBeatTime += 60 / this.bpm
    }
    this.timer = window.setTimeout(this.schedule, 60)
  }

  /** ドクン…（二段鼓動） */
  private playHeartbeat(t: number) {
    if (!this.ctx || !this.master) return
    const intensity = Math.min(1, 0.55 + (this.bpm - 60) / 160)
    this.thump(t, 0.9 * intensity, 62, 38)
    this.thump(t + 0.17, 0.6 * intensity, 54, 34)
  }

  private thump(t: number, gain: number, f0: number, f1: number) {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(f1, t + 0.12)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 140
    lp.Q.value = 0.8

    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)

    // 胸に響くノイズ成分
    const noise = ctx.createBufferSource()
    const len = Math.floor(ctx.sampleRate * 0.06)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    noise.buffer = buf
    const ng = ctx.createGain()
    ng.gain.value = gain * 0.12
    const nlp = ctx.createBiquadFilter()
    nlp.type = 'lowpass'
    nlp.frequency.value = 200

    osc.connect(lp).connect(g).connect(this.master)
    noise.connect(nlp).connect(ng).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.3)
    noise.start(t)
    noise.stop(t + 0.07)
  }

  /** カードを置く「パシッ」 */
  playPlace() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const len = Math.floor(ctx.sampleRate * 0.08)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 0.7
    const g = ctx.createGain()
    g.gain.value = 0.35
    src.connect(bp).connect(g).connect(this.master)
    src.start(t)
  }

  /** カードをめくる「シュッ」 */
  playFlip() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const len = Math.floor(ctx.sampleRate * 0.25)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(600, t)
    bp.frequency.exponentialRampToValueAtTime(3200, t + 0.2)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    src.connect(bp).connect(g).connect(this.master)
    src.start(t)
  }

  /** 勝利：黄金の鐘 */
  playWin() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = f
      const g = ctx.createGain()
      const st = t + i * 0.12
      g.gain.setValueAtTime(0.0001, st)
      g.gain.exponentialRampToValueAtTime(0.22, st + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, st + 1.2)
      osc.connect(g).connect(this.master!)
      osc.start(st)
      osc.stop(st + 1.3)
    })
  }

  /** 敗北：低く沈むドローン */
  playLose() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(110, t)
    osc.frequency.exponentialRampToValueAtTime(48, t + 1.4)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(900, t)
    lp.frequency.exponentialRampToValueAtTime(120, t + 1.4)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
    osc.connect(lp).connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + 1.7)
  }

  /** 引き分け：乾いた金属音 */
  playDraw() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 220
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.4)
  }
}

export const audio = new HeartbeatEngine()

/**
 * ターン進行と REVEAL フェーズに応じた心拍 BPM。
 * Turn1: 64 → Turn5: 112、REVEAL 直前はさらに ×1.5 で最高 168 まで上がる。
 */
export function bpmFor(turn: number, phase: string): number {
  const base = 64 + (turn - 1) * 12
  if (phase === 'reveal') return Math.round(base * 1.5)
  if (phase === 'cpuThinking') return Math.round(base * 1.15)
  return base
}
