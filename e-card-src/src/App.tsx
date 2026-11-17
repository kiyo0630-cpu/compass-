import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { Crown, Link2, Vibrate, VibrateOff, Volume2, VolumeX } from 'lucide-react'
import type { GameState, Impact, SetRecord, Side } from './game/types'
import { MAX_TURNS, WIN_TARGET } from './game/types'
import {
  cpuChoose,
  cpuStyleFor,
  cpuThinkDelay,
  initialHand,
  isClash,
  makeTell,
  otherSide,
  outcomeFor,
  pointsFor,
  removeAt,
  score,
  SIDE_LABEL,
  TELL_TEXT,
  winPoints,
} from './game/logic'
import { audio, bpmFor } from './audio/heartbeat'
import { haptics } from './haptics'
import { Card } from './components/Card'
import { ScoreBoard } from './components/ScoreBoard'
import { StartScreen } from './components/StartScreen'
import { ResultOverlay } from './components/ResultOverlay'
import { MatchOverlay } from './components/MatchOverlay'
import { ZawaLayer } from './components/ZawaLayer'
import { Lightning } from './components/Lightning'
import { Graveyard, Odds } from './components/Graveyard'
import { CpuFace } from './art/CpuFace'
import type { FaceMood } from './art/CpuFace'

/** 双方が出し終えてからめくり始めるまでのタメ */
const REVEAL_DELAY_MS = 1500
/** めくり始めてから表面が見える（＝衝撃演出を出す）までの時間 */
const FACE_VISIBLE_MS = 650
/** 衝撃演出を見せてから結果オーバーレイを出すまでの時間 */
const IMPACT_HOLD_MS: Record<Impact, number> = { none: 750, hit: 850, clash: 1350 }
const SET_INTRO_MS = 1700

/** 上スワイプで「出した」とみなす距離（px）と速度（px/s） */
const SWIPE_DISTANCE = 56
const SWIPE_VELOCITY = 520
/** これ未満の移動はドラッグではなくタップとして扱う（px） */
const TAP_SLOP = 12

const SHAKE_HARD = {
  x: [0, -13, 15, -11, 9, -6, 3, 0],
  y: [0, 8, -10, 7, -5, 3, -1, 0],
  rotate: [0, -0.7, 0.8, -0.5, 0.4, -0.2, 0, 0],
  transition: { duration: 0.75, ease: 'easeOut' as const },
}
const SHAKE_SOFT = {
  x: [0, -4, 5, -3, 2, 0],
  y: [0, 3, -3, 2, -1, 0],
  rotate: 0,
  transition: { duration: 0.35, ease: 'easeOut' as const },
}

const DEV_CPU = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('cpu') : null

function loadFlag(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

function saveFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* プライベートブラウズなどで保存できなくても遊べる */
  }
}

function baseState(): GameState {
  return {
    phase: 'start',
    playerSide: 'king',
    setNo: 1,
    turn: 1,
    playerHand: [],
    playerHandIds: [],
    cpuHand: [],
    playerPlayed: null,
    cpuPlayed: null,
    revealed: false,
    impact: 'none',
    turnOutcome: null,
    history: [],
    selectedIdx: null,
    bonusMode: false,
    cpuStyle: 'normal',
    cpuPlan: null,
  }
}

function initialState(): GameState {
  // 開発サーバー限定: ?debug=win / ?debug=lose で最終結果画面を直接確認できる
  if (import.meta.env.DEV) {
    const dbg = new URLSearchParams(window.location.search).get('debug')
    if (dbg === 'win' || dbg === 'lose') {
      const w = (playerSide: Side, points = 1): SetRecord => ({ outcome: 'win', points, playerSide })
      const l = (playerSide: Side, points = 1): SetRecord => ({ outcome: 'lose', points, playerSide })
      const d = (playerSide: Side): SetRecord => ({ outcome: 'draw', points: 0, playerSide })
      const history =
        dbg === 'win'
          ? [w('king'), l('slave'), w('king'), d('slave'), w('king'), l('slave'), w('king'), w('slave')]
          : [l('king'), w('slave'), l('king'), l('slave'), d('king'), w('slave'), l('king'), l('slave')]
      return { ...baseState(), phase: 'matchOver', history, setNo: history.length }
    }
  }
  return baseState()
}

/**
 * ターン開始。CPU はこの時点で出す手を決め、それに応じた表情（本音かブラフ）を見せる。
 * 伏せ札は誰にも見えないので、先攻・後攻に関係なくここで決めても公平性は変わらない。
 * 毎ターン奴隷側が先攻: プレイヤーが王様側なら CPU から、奴隷側ならプレイヤーから。
 */
function beginTurn(s: GameState): GameState {
  let idx = cpuChoose(s.cpuHand, s.turn, s.cpuStyle)
  if (DEV_CPU) {
    // 開発サーバー限定: ?cpu=special / ?cpu=citizen で CPU の手を固定して演出を確認する
    const wanted = s.cpuHand.findIndex((c) => (DEV_CPU === 'special' ? c !== 'citizen' : c === 'citizen'))
    if (wanted >= 0) idx = wanted
  }
  const tell = makeTell(s.cpuHand[idx] !== 'citizen')
  return {
    ...s,
    cpuPlan: { idx, tell },
    phase: s.playerSide === 'king' ? 'cpuThinking' : 'playerSelect',
  }
}

const FACE_TEXT: Record<FaceMood, string> = {
  ...TELL_TEXT,
  thinking: '………',
  shock: 'ぐっ……！',
  triumph: 'ククク……',
}

const STYLE_HINT = {
  normal: null,
  aggressive: 'CPUは焦っている……速攻の気配',
  cautious: 'CPUは勝利目前……じっくり機を待つ構え',
} as const

export default function App() {
  const [state, setState] = useState<GameState>(initialState)
  // タイマーやタップから「いまの状態」を同期的に読むための参照。更新は必ず apply を通す
  const stateRef = useRef(state)
  const apply = useCallback((next: GameState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const [muted, setMuted] = useState(() => loadFlag('ecard.muted', false))
  const [hapticsOn, setHapticsOn] = useState(() => loadFlag('ecard.haptics', true))
  const [bonusMode, setBonusMode] = useState(() => loadFlag('ecard.bonus', false))
  const hapticsAvailable = haptics.support() !== 'none'

  const shake = useAnimationControls()
  // 手札を押してから離すまでの移動量。タップとスワイプの区別に使う
  // （Framer Motion の onDragStart / onDragEnd は次の描画フレームまで遅れるので、クリックとの前後が保証されない）
  const pressRef = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(0)

  const { player: playerPts, cpu: cpuPts } = useMemo(() => score(state.history), [state.history])
  const matchDecided = playerPts >= WIN_TARGET || cpuPts >= WIN_TARGET

  /* ---------- 設定の反映と保存 ---------- */
  useEffect(() => {
    audio.setMuted(muted)
    saveFlag('ecard.muted', muted)
  }, [muted])

  useEffect(() => {
    haptics.setEnabled(hapticsOn)
    saveFlag('ecard.haptics', hapticsOn)
  }, [hapticsOn])

  useEffect(() => {
    saveFlag('ecard.bonus', bonusMode)
  }, [bonusMode])

  /* ---------- 心拍（音＋振動） ---------- */
  useEffect(() => {
    // 鼓動の「ドクン」に合わせてスマホも脈打たせる
    audio.onBeat = () => haptics.beat([26, 144, 16])
    return () => {
      audio.onBeat = null
    }
  }, [])

  useEffect(() => {
    if (state.phase === 'start' || state.phase === 'matchOver') {
      audio.stop()
      return
    }
    audio.setBpm(bpmFor(state.turn, state.phase))
    audio.start()
  }, [state.phase, state.turn])

  /* ---------- フェーズ駆動のタイマー ---------- */
  useEffect(() => {
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms))
    }
    const phase = stateRef.current.phase

    if (phase === 'setIntro') {
      at(SET_INTRO_MS, () => {
        const s = stateRef.current
        if (s.phase === 'setIntro') apply(beginTurn(s))
      })
    }

    if (phase === 'cpuThinking') {
      at(cpuThinkDelay(), () => {
        const s = stateRef.current
        if (s.phase !== 'cpuThinking' || !s.cpuPlan) return
        const idx = s.cpuPlan.idx
        audio.playPlace()
        haptics.pulse(18)
        apply({
          ...s,
          cpuPlayed: s.cpuHand[idx],
          cpuHand: removeAt(s.cpuHand, idx),
          // プレイヤーがまだ出していなければ選択へ、既に出していれば公開へ
          phase: s.playerPlayed ? 'reveal' : 'playerSelect',
        })
      })
    }

    if (phase === 'reveal') {
      // 1) 1.5 秒のタメ（この間カードの端がじわりと持ち上がる）→ めくり開始
      at(REVEAL_DELAY_MS, () => {
        const s = stateRef.current
        if (s.phase !== 'reveal') return
        audio.playFlip()
        apply({ ...s, revealed: true })
      })
      // 2) 表面が見えた瞬間に衝撃演出
      at(REVEAL_DELAY_MS + FACE_VISIBLE_MS, () => {
        const s = stateRef.current
        if (s.phase !== 'reveal' || !s.playerPlayed || !s.cpuPlayed) return
        const outcome = outcomeFor(s.playerSide, s.playerPlayed, s.cpuPlayed)
        const impact: Impact = isClash(s.playerPlayed, s.cpuPlayed) ? 'clash' : outcome === 'draw' ? 'none' : 'hit'
        apply({ ...s, turnOutcome: outcome, impact })
        if (impact === 'clash') {
          audio.playThunder()
          haptics.pulse([80, 40, 140, 50, 240])
          void shake.start(SHAKE_HARD)
        } else if (impact === 'hit') {
          audio.playThud()
          haptics.pulse(70)
          void shake.start(SHAKE_SOFT)
        }
        // 3) 余韻のあと結果オーバーレイ
        at(IMPACT_HOLD_MS[impact], () => {
          const s2 = stateRef.current
          if (s2.phase !== 'reveal' || !s2.turnOutcome) return
          const result = s2.turnOutcome
          const setOver = result !== 'draw' || s2.turn >= MAX_TURNS
          if (result === 'win') {
            audio.playWin()
            haptics.pulse([40, 60, 40, 60, 120])
          } else if (result === 'lose') {
            audio.playLose()
            haptics.pulse(320)
          } else {
            audio.playDraw()
          }
          const record: SetRecord = {
            outcome: result,
            points: pointsFor(result, s2.playerSide, s2.bonusMode),
            playerSide: s2.playerSide,
          }
          apply({
            ...s2,
            impact: 'none',
            phase: setOver ? 'setResult' : 'turnResult',
            history: setOver ? [...s2.history, record] : s2.history,
          })
        })
      })
    }

    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [state.phase, state.setNo, state.turn, apply, shake])

  /* ---------- ユーザー操作 ---------- */
  const chooseSide = useCallback(
    async (side: Side) => {
      // スタート画面のタップで AudioContext を確実にアンロック
      await audio.unlock()
      audio.setMuted(muted)
      haptics.pulse(20)
      apply({
        ...baseState(),
        phase: 'setIntro',
        playerSide: side,
        playerHand: initialHand(side),
        playerHandIds: [0, 1, 2, 3, 4],
        cpuHand: initialHand(otherSide(side)),
        bonusMode,
      })
    },
    [apply, muted, bonusMode],
  )

  const playCard = useCallback(
    (idx: number) => {
      const s = stateRef.current
      if (s.phase !== 'playerSelect' || idx < 0 || idx >= s.playerHand.length) return
      audio.playPlace()
      haptics.pulse(22)
      apply({
        ...s,
        playerPlayed: s.playerHand[idx],
        playerHand: removeAt(s.playerHand, idx),
        playerHandIds: removeAt(s.playerHandIds, idx),
        selectedIdx: null,
        phase: s.cpuPlayed ? 'reveal' : 'cpuThinking',
      })
    },
    [apply],
  )

  const tapCard = useCallback(
    (idx: number) => {
      // スワイプ（ドラッグ）の終わりに発火するクリックは無視する
      if (movedRef.current >= TAP_SLOP) return
      const s = stateRef.current
      if (s.phase !== 'playerSelect') return
      // 選択済みカードをもう一度タップ → 確定（2 回タップ）
      if (s.selectedIdx === idx) {
        playCard(idx)
        return
      }
      haptics.pulse(8)
      apply({ ...s, selectedIdx: idx })
    },
    [apply, playCard],
  )

  const confirmCard = useCallback(() => {
    const s = stateRef.current
    if (s.selectedIdx !== null) playCard(s.selectedIdx)
  }, [playCard])

  const onCardDragEnd = useCallback(
    (idx: number, info: PanInfo) => {
      // 指がわずかにぶれただけのタップはスワイプ扱いしない
      if (Math.hypot(info.offset.x, info.offset.y) < TAP_SLOP) return
      // 場に向かって上へ投げたら提出
      if (info.offset.y < -SWIPE_DISTANCE || info.velocity.y < -SWIPE_VELOCITY) playCard(idx)
    },
    [playCard],
  )

  const nextTurn = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'turnResult') return
    apply(
      beginTurn({
        ...s,
        turn: s.turn + 1,
        playerPlayed: null,
        cpuPlayed: null,
        revealed: false,
        turnOutcome: null,
        selectedIdx: null,
        cpuPlan: null,
      }),
    )
  }, [apply])

  const nextSet = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'setResult') return
    const pts = score(s.history)
    if (pts.player >= WIN_TARGET || pts.cpu >= WIN_TARGET) {
      haptics.pulse(pts.player >= WIN_TARGET ? [60, 60, 60, 60, 200] : 500)
      apply({ ...s, phase: 'matchOver' })
      return
    }
    const side = otherSide(s.playerSide)
    apply({
      ...s,
      phase: 'setIntro',
      playerSide: side,
      setNo: s.setNo + 1,
      turn: 1,
      playerHand: initialHand(side),
      playerHandIds: [0, 1, 2, 3, 4],
      cpuHand: initialHand(otherSide(side)),
      playerPlayed: null,
      cpuPlayed: null,
      revealed: false,
      impact: 'none',
      turnOutcome: null,
      selectedIdx: null,
      cpuPlan: null,
      // スコア状況で CPU の性格が変わる（負け越し→速攻、リーチ→慎重）
      cpuStyle: cpuStyleFor(pts.cpu, pts.player, winPoints(otherSide(side), s.bonusMode)),
    })
  }, [apply])

  const restart = useCallback(() => apply(baseState()), [apply])

  if (state.phase === 'start') {
    return (
      <StartScreen
        onChoose={chooseSide}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        hapticsAvailable={hapticsAvailable}
        hapticsOn={hapticsOn}
        onToggleHaptics={() => {
          const next = !hapticsOn
          setHapticsOn(next)
          // オンにした瞬間に 1 回震わせて、効いているか分かるようにする
          haptics.setEnabled(next)
          if (next) haptics.pulse(40)
        }}
        bonusMode={bonusMode}
        onToggleBonus={() => setBonusMode((b) => !b)}
      />
    )
  }

  const isKing = state.playerSide === 'king'
  const cpuSide = otherSide(state.playerSide)
  const canSelect = state.phase === 'playerSelect'
  const peeking = state.phase === 'reveal' && !state.revealed
  const beatSec = 60 / bpmFor(state.turn, state.phase)
  const lastRecord = state.history[state.history.length - 1]

  // CPU の顔: 思考中 → 表情シグナル → 決着後のリアクション
  const faceMood: FaceMood = (() => {
    if (state.turnOutcome) {
      return state.turnOutcome === 'win' ? 'shock' : state.turnOutcome === 'lose' ? 'triumph' : 'poker'
    }
    if (state.phase === 'cpuThinking' && !state.playerPlayed) return 'thinking'
    if (state.cpuPlan && state.phase !== 'setIntro') return state.cpuPlan.tell
    return 'poker'
  })()

  // 「ざわ…」の濃さ: CPU 思考中・オープン直前・終盤ほど強く
  const zawa = (() => {
    const late = Math.max(0, state.turn - 3) * 0.6
    if (state.phase === 'reveal') return state.revealed ? 0 : 3 + late
    if (state.phase === 'cpuThinking') return 2 + late
    if (state.phase === 'playerSelect' && state.turn >= 3) return 1 + late
    return 0
  })()

  const statusText = (() => {
    switch (state.phase) {
      case 'setIntro':
        return `SET ${state.setNo} ─ あなたは${SIDE_LABEL[state.playerSide]}`
      case 'cpuThinking':
        return isKing ? 'CPU（奴隷側）が先に伏せる…' : 'CPU（王様側）が思考中…'
      case 'playerSelect':
        return isKing ? 'CPUは伏せた。1枚を選べ' : 'あなたが先攻。1枚を伏せろ'
      case 'reveal':
        return state.revealed ? 'OPEN!' : '……同時にオープン……'
      default:
        return ''
    }
  })()

  return (
    <motion.div
      animate={shake}
      className="gamble-bg safe-top safe-bottom relative mx-auto flex h-[100dvh] max-w-md flex-col justify-between overflow-hidden"
    >
      {/* ===== ヘッダー ===== */}
      <header className="relative z-10 flex flex-col gap-1.5 px-3 pt-2">
        <div className="flex items-center justify-between text-[11px] font-bold tracking-wider">
          <span className="rounded border border-white/15 bg-black/50 px-2 py-1 text-white/80">
            SET <span className="gold-text text-sm">{state.setNo}</span>
          </span>
          <span
            className={`flex items-center gap-1 rounded-full border px-3 py-1 ${
              isKing ? 'border-gold/70 bg-blood-dark/60 text-gold-light' : 'border-emerald-700 bg-emerald-950/70 text-emerald-200'
            }`}
          >
            {isKing ? <Crown size={13} /> : <Link2 size={13} />}
            {SIDE_LABEL[state.playerSide]}
            {state.bonusMode && !isKing && <span className="ml-0.5 rounded bg-gold px-1 text-[9px] font-black text-black">×2</span>}
          </span>
          <span className="rounded border border-white/15 bg-black/50 px-2 py-1 text-white/80">
            TURN <span className="text-sm text-gold-light">{state.turn}</span>/{MAX_TURNS}
          </span>
          <span className="flex gap-1.5">
            {hapticsAvailable && (
              <button
                type="button"
                onClick={() => setHapticsOn((v) => !v)}
                className="rounded-full border border-gold/40 bg-black/50 p-1.5 text-gold"
                aria-label={hapticsOn ? '振動をオフ' : '振動をオン'}
              >
                {hapticsOn ? <Vibrate size={15} /> : <VibrateOff size={15} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="rounded-full border border-gold/40 bg-black/50 p-1.5 text-gold"
              aria-label={muted ? 'ミュート解除' : 'ミュート'}
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </span>
        </div>
        <ScoreBoard history={state.history} currentSet={state.setNo} matchOver={state.phase === 'matchOver'} />
      </header>

      {/* ===== CPU（顔・表情シグナル・手札） ===== */}
      <section className="relative z-10 flex items-center gap-2 px-3 pt-1.5">
        <CpuFace mood={faceMood} className="h-[9dvh] w-[9dvh] shrink-0" />
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={faceMood}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="truncate text-[13px] font-bold text-red-100"
              style={{ fontFamily: 'var(--font-serif-jp)' }}
              data-testid="cpu-tell"
            >
              {FACE_TEXT[faceMood]}
            </motion.p>
          </AnimatePresence>
          <p className="mt-0.5 truncate text-[10px]">
            {state.phase === 'cpuThinking' ? (
              <span className="text-red-200">
                CPUが思考中… <span className="zawa">ざわ…</span> <span className="zawa zawa-2">ざわ…</span>
              </span>
            ) : (
              <span className="text-white/45">
                CPU ─ {SIDE_LABEL[cpuSide]} ／ 残り {state.cpuHand.length} 枚
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-center pr-1">
          <AnimatePresence initial={false}>
            {state.cpuHand.map((_, i) => (
              <motion.div
                key={`cpu-${state.setNo}-${i}-${state.cpuHand.length}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="-ml-3 first:ml-0"
                style={{ rotate: (i - (state.cpuHand.length - 1) / 2) * 5 }}
              >
                <Card type={null} faceUp={false} className="h-[7dvh]" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* ===== 場（バトルフィールド） ===== */}
      <main
        className={`table-felt relative z-0 mx-3 my-1.5 flex min-h-0 flex-1 flex-col items-center justify-between rounded-2xl px-3 py-2 ${
          state.phase === 'reveal' || state.phase === 'cpuThinking' ? 'heartbeat-glow' : ''
        }`}
        style={{ ['--beat' as string]: `${beatSec}s` }}
      >
        {/* 捨て札トラッカーと、相手の特殊カード率 */}
        <div className="absolute left-2 top-2">
          <Graveyard discarded={state.turn - 1} />
        </div>
        <div className="absolute right-2 top-2">
          <Odds cpuSide={cpuSide} remaining={MAX_TURNS + 1 - state.turn} />
        </div>

        {/* CPU の札 */}
        <Slot>
          {state.cpuPlayed && (
            <motion.div
              key={`cpu-played-${state.setNo}-${state.turn}`}
              initial={{ y: -60, opacity: 0, scale: 0.6 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              <Card type={state.cpuPlayed} faceUp={state.revealed} peek={peeking} className="h-[14dvh]" />
            </motion.div>
          )}
        </Slot>

        {/* 中央ステータス */}
        <div className="pointer-events-none flex h-8 items-center justify-center text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={statusText}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`whitespace-nowrap text-sm font-bold tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${
                state.phase === 'reveal' ? (state.revealed ? 'gold-text text-2xl' : 'animate-pulse text-red-200') : 'text-gold-light/90'
              }`}
              style={{ fontFamily: 'var(--font-serif-jp)' }}
            >
              {statusText}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* プレイヤーの札 */}
        <Slot>
          {state.playerPlayed && (
            <motion.div
              key={`you-played-${state.setNo}-${state.turn}`}
              initial={{ y: 60, opacity: 0, scale: 0.6 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              <Card type={state.playerPlayed} faceUp={state.revealed} peek={peeking} className="h-[14dvh]" />
            </motion.div>
          )}
        </Slot>
      </main>

      {/* ===== プレイヤー手札 ===== */}
      <footer className="relative z-10 flex flex-col items-center gap-2 px-3 pb-3 pt-1">
        <div className="flex items-end justify-center gap-1.5">
          <AnimatePresence initial={false}>
            {state.playerHand.map((card, i) => (
              <motion.div
                key={`hand-${state.setNo}-${state.playerHandIds[i]}`}
                layout
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -70, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                // 上スワイプ（フリック）で場に投げる
                drag={canSelect}
                dragSnapToOrigin
                dragMomentum={false}
                dragElastic={0.9}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                whileDrag={{ scale: 1.12, zIndex: 40 }}
                onPointerDown={(e) => {
                  pressRef.current = { x: e.clientX, y: e.clientY }
                  movedRef.current = 0
                }}
                onPointerUp={(e) => {
                  const p = pressRef.current
                  if (p) movedRef.current = Math.hypot(e.clientX - p.x, e.clientY - p.y)
                }}
                onDragEnd={(_, info) => onCardDragEnd(i, info)}
                className="relative touch-none"
                data-testid="hand-card"
              >
                <Card
                  type={card}
                  faceUp
                  className="h-[min(14dvh,25vw)] touch-none"
                  selected={state.selectedIdx === i}
                  dimmed={!canSelect}
                  onClick={canSelect ? () => tapCard(i) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <motion.button
          type="button"
          whileTap={canSelect && state.selectedIdx !== null ? { scale: 0.97 } : undefined}
          onClick={confirmCard}
          disabled={!canSelect || state.selectedIdx === null}
          className={`w-full rounded-xl border py-3 text-base font-bold tracking-wider transition-colors ${
            canSelect && state.selectedIdx !== null
              ? 'border-gold/80 bg-gradient-to-b from-gold-dark/70 to-black/80 text-gold-light shadow-[0_0_24px_rgba(227,183,78,0.3)]'
              : 'border-white/10 bg-black/40 text-white/40'
          }`}
        >
          {canSelect
            ? state.selectedIdx !== null
              ? 'このカードを出す'
              : 'タップで選択 ／ 上スワイプで出す'
            : state.phase === 'reveal'
              ? '……'
              : '待て……'}
        </motion.button>
      </footer>

      {/* ===== 演出レイヤー ===== */}
      <ZawaLayer intensity={zawa} />
      {state.impact === 'clash' && <Lightning key={`bolt-${state.setNo}-${state.turn}`} />}

      {/* ===== オーバーレイ ===== */}
      <AnimatePresence>
        {state.phase === 'setIntro' && (
          <motion.div
            key="intro"
            // 操作する要素が無いのでタッチは常に素通しにする（消え際に手札の操作を遮らない）
            className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 px-6 text-center backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.p
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              className="gold-text text-6xl font-black"
              style={{ fontFamily: 'var(--font-serif-jp)' }}
            >
              SET {state.setNo}
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`mt-3 flex items-center gap-2 text-xl font-bold ${isKing ? 'text-gold-light' : 'text-emerald-200'}`}
            >
              {isKing ? <Crown size={22} /> : <Link2 size={22} />}
              あなたは {SIDE_LABEL[state.playerSide]}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-2 text-xs text-white/60"
            >
              {isKing ? '後攻 ─ CPUの伏せ札を見てから出せ' : '先攻 ─ 先に1枚を伏せろ'}
            </motion.p>
            {state.bonusMode && (
              <motion.p
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.75 }}
                className="mt-3 rounded-full border border-gold/70 bg-gold/10 px-3 py-1 text-xs font-bold text-gold-light"
              >
                {isKing ? 'CPUが奴隷側 ─ 王を討たれると CPU +2' : '奴隷で王を討てば 一気に +2'}
              </motion.p>
            )}
            {STYLE_HINT[state.cpuStyle] && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="mt-3 text-xs text-red-200/90"
                style={{ fontFamily: 'var(--font-serif-jp)' }}
                data-testid="cpu-style"
              >
                {STYLE_HINT[state.cpuStyle]}
              </motion.p>
            )}
          </motion.div>
        )}

        {(state.phase === 'turnResult' || state.phase === 'setResult') &&
          state.turnOutcome &&
          state.playerPlayed &&
          state.cpuPlayed && (
            <ResultOverlay
              key={`result-${state.setNo}-${state.turn}`}
              kind={state.phase === 'turnResult' ? 'turn' : 'set'}
              outcome={state.turnOutcome}
              playerCard={state.playerPlayed}
              cpuCard={state.cpuPlayed}
              turn={state.turn}
              setNo={state.setNo}
              playerWins={playerPts}
              cpuWins={cpuPts}
              points={state.phase === 'setResult' && lastRecord ? lastRecord.points : 0}
              matchDecided={matchDecided}
              onNext={state.phase === 'turnResult' ? nextTurn : nextSet}
            />
          )}

        {state.phase === 'matchOver' && (
          <MatchOverlay key="match" playerWon={playerPts >= WIN_TARGET} history={state.history} onRestart={restart} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** 場のカード置き場。空のときは破線枠を描く */
function Slot({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex aspect-[2/3] h-[14dvh] items-center justify-center">
      <div className="absolute inset-0 rounded-[6%] border-2 border-dashed border-gold/25" />
      <AnimatePresence>{children}</AnimatePresence>
    </div>
  )
}
