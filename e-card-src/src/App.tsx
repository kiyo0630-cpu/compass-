import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Link2, Volume2, VolumeX } from 'lucide-react'
import type { GameState, Outcome, Side } from './game/types'
import { MAX_TURNS, WIN_TARGET } from './game/types'
import {
  cpuChoose,
  cpuThinkDelay,
  initialHand,
  otherSide,
  outcomeFor,
  removeAt,
  SIDE_LABEL,
} from './game/logic'
import { audio, bpmFor } from './audio/heartbeat'
import { Card } from './components/Card'
import { ScoreBoard } from './components/ScoreBoard'
import { StartScreen } from './components/StartScreen'
import { ResultOverlay } from './components/ResultOverlay'
import { MatchOverlay } from './components/MatchOverlay'

const REVEAL_DELAY_MS = 1500
const FLIP_MS = 850
const SET_INTRO_MS = 1500

function freshState(): GameState {
  if (import.meta.env.DEV) {
    const dbg = new URLSearchParams(window.location.search).get('debug')
    if (dbg === 'win' || dbg === 'lose') {
      const history: Outcome[] = dbg === 'win'
        ? ['win', 'lose', 'win', 'draw', 'win', 'lose', 'win', 'win']
        : ['lose', 'win', 'lose', 'lose', 'draw', 'win', 'lose', 'lose']
      return { ...baseState(), phase: 'matchOver', history, setNo: history.length }
    }
  }
  return baseState()
}

function baseState(): GameState {
  return {
    phase: 'start',
    playerSide: 'king',
    setNo: 1,
    turn: 1,
    playerHand: [],
    cpuHand: [],
    playerPlayed: null,
    cpuPlayed: null,
    revealed: false,
    turnOutcome: null,
    history: [],
    selectedIdx: null,
  }
}

/** 奴隷側が先攻。プレイヤーが王様側なら CPU（奴隷側）から、奴隷側ならプレイヤーから */
function firstPhaseOfTurn(playerSide: Side): GameState['phase'] {
  return playerSide === 'king' ? 'cpuThinking' : 'playerSelect'
}

export default function App() {
  const [state, setState] = useState<GameState>(freshState)
  const [muted, setMuted] = useState(false)

  const playerWins = useMemo(() => state.history.filter((h) => h === 'win').length, [state.history])
  const cpuWins = useMemo(() => state.history.filter((h) => h === 'lose').length, [state.history])
  const matchDecided = playerWins >= WIN_TARGET || cpuWins >= WIN_TARGET

  /* ---------- 心拍 BPM 制御 ---------- */
  useEffect(() => {
    if (state.phase === 'start' || state.phase === 'matchOver') {
      audio.stop()
      return
    }
    audio.setBpm(bpmFor(state.turn, state.phase))
    audio.start()
  }, [state.phase, state.turn])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      audio.setMuted(!m)
      return !m
    })
  }, [])

  /* ---------- フェーズ駆動のタイマー ---------- */
  useEffect(() => {
    let t1: number | undefined
    let t2: number | undefined

    if (state.phase === 'setIntro') {
      t1 = window.setTimeout(() => {
        setState((s) => ({ ...s, phase: firstPhaseOfTurn(s.playerSide) }))
      }, SET_INTRO_MS)
    }

    if (state.phase === 'cpuThinking') {
      t1 = window.setTimeout(() => {
        setState((s) => {
          if (s.phase !== 'cpuThinking') return s
          const idx = cpuChoose(s.cpuHand, s.turn)
          const card = s.cpuHand[idx]
          audio.playPlace()
          return {
            ...s,
            cpuPlayed: card,
            cpuHand: removeAt(s.cpuHand, idx),
            // プレイヤーがまだ出していなければ選択へ、既に出していれば公開へ
            phase: s.playerPlayed ? 'reveal' : 'playerSelect',
          }
        })
      }, cpuThinkDelay())
    }

    if (state.phase === 'reveal' && !state.revealed) {
      t1 = window.setTimeout(() => {
        audio.playFlip()
        setState((s) => (s.phase === 'reveal' ? { ...s, revealed: true } : s))
      }, REVEAL_DELAY_MS)
    }

    if (state.phase === 'reveal' && state.revealed) {
      t2 = window.setTimeout(() => {
        setState((s) => {
          if (s.phase !== 'reveal' || !s.playerPlayed || !s.cpuPlayed) return s
          const outcome: Outcome = outcomeFor(s.playerSide, s.playerPlayed, s.cpuPlayed)
          const setOver = outcome !== 'draw' || s.turn >= MAX_TURNS
          if (outcome === 'win') audio.playWin()
          else if (outcome === 'lose') audio.playLose()
          else audio.playDraw()
          return {
            ...s,
            turnOutcome: outcome,
            phase: setOver ? 'setResult' : 'turnResult',
            history: setOver ? [...s.history, outcome] : s.history,
          }
        })
      }, FLIP_MS)
    }

    return () => {
      if (t1) window.clearTimeout(t1)
      if (t2) window.clearTimeout(t2)
    }
  }, [state.phase, state.revealed])

  /* ---------- ユーザー操作 ---------- */
  const chooseSide = useCallback(async (side: Side) => {
    // スタート画面のタップで AudioContext を確実にアンロック
    await audio.unlock()
    audio.setMuted(muted)
    setState({
      ...freshState(),
      phase: 'setIntro',
      playerSide: side,
      playerHand: initialHand(side),
      cpuHand: initialHand(otherSide(side)),
    })
  }, [muted])

  const selectCard = useCallback((idx: number) => {
    setState((s) => {
      if (s.phase !== 'playerSelect') return s
      return { ...s, selectedIdx: s.selectedIdx === idx ? null : idx }
    })
  }, [])

  const confirmCard = useCallback(() => {
    setState((s) => {
      if (s.phase !== 'playerSelect' || s.selectedIdx === null) return s
      const card = s.playerHand[s.selectedIdx]
      audio.playPlace()
      return {
        ...s,
        playerPlayed: card,
        playerHand: removeAt(s.playerHand, s.selectedIdx),
        selectedIdx: null,
        phase: s.cpuPlayed ? 'reveal' : 'cpuThinking',
      }
    })
  }, [])

  const nextTurn = useCallback(() => {
    setState((s) => ({
      ...s,
      turn: s.turn + 1,
      playerPlayed: null,
      cpuPlayed: null,
      revealed: false,
      turnOutcome: null,
      selectedIdx: null,
      phase: firstPhaseOfTurn(s.playerSide),
    }))
  }, [])

  const nextSet = useCallback(() => {
    setState((s) => {
      const pw = s.history.filter((h) => h === 'win').length
      const cw = s.history.filter((h) => h === 'lose').length
      if (pw >= WIN_TARGET || cw >= WIN_TARGET) {
        return { ...s, phase: 'matchOver' }
      }
      const side = otherSide(s.playerSide)
      return {
        ...s,
        phase: 'setIntro',
        playerSide: side,
        setNo: s.setNo + 1,
        turn: 1,
        playerHand: initialHand(side),
        cpuHand: initialHand(otherSide(side)),
        playerPlayed: null,
        cpuPlayed: null,
        revealed: false,
        turnOutcome: null,
        selectedIdx: null,
      }
    })
  }, [])

  const restart = useCallback(() => setState(freshState()), [])

  if (state.phase === 'start') {
    return <StartScreen onChoose={chooseSide} muted={muted} onToggleMute={toggleMute} />
  }

  const isKing = state.playerSide === 'king'
  const canSelect = state.phase === 'playerSelect'
  const beatSec = 60 / bpmFor(state.turn, state.phase)

  const statusText = (() => {
    switch (state.phase) {
      case 'setIntro':
        return `SET ${state.setNo} ─ あなたは${SIDE_LABEL[state.playerSide]}`
      case 'cpuThinking':
        return isKing ? 'CPU（奴隷側）が先に伏せる…' : 'CPU（王様側）が思考中…'
      case 'playerSelect':
        return isKing ? 'CPUは伏せた。あなたの1枚を選べ' : 'あなたが先攻。1枚を伏せろ'
      case 'reveal':
        return state.revealed ? 'OPEN!' : '……同時にオープン……'
      default:
        return ''
    }
  })()

  return (
    <div className="gamble-bg safe-top safe-bottom relative mx-auto flex h-[100dvh] max-w-md flex-col justify-between overflow-hidden">
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
          </span>
          <span className="rounded border border-white/15 bg-black/50 px-2 py-1 text-white/80">
            TURN <span className="text-sm text-gold-light">{state.turn}</span>/{MAX_TURNS}
          </span>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-full border border-gold/40 bg-black/50 p-1.5 text-gold"
            aria-label={muted ? 'ミュート解除' : 'ミュート'}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
        <ScoreBoard history={state.history} currentSet={state.setNo} matchOver={state.phase === 'matchOver'} />
      </header>

      {/* ===== CPU 手札 ===== */}
      <section className="relative z-10 flex flex-col items-center px-3 pt-1.5">
        <div className="flex items-center justify-center">
          <AnimatePresence initial={false}>
            {state.cpuHand.map((_, i) => (
              <motion.div
                key={`cpu-${state.setNo}-${i}-${state.cpuHand.length}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="-ml-3 first:ml-0"
                style={{ transform: `rotate(${(i - (state.cpuHand.length - 1) / 2) * 5}deg)` }}
              >
                <Card type={null} faceUp={false} className="h-[7dvh]" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="mt-1 h-4 text-center text-[11px] text-white/70">
          {state.phase === 'cpuThinking' ? (
            <span className="text-red-200">
              CPUが思考中… <span className="zawa">ざわ…</span> <span className="zawa zawa-2">ざわ…</span>
            </span>
          ) : (
            <span className="text-white/45">CPU ─ {SIDE_LABEL[otherSide(state.playerSide)]} ／ 残り {state.cpuHand.length} 枚</span>
          )}
        </div>
      </section>

      {/* ===== 場（バトルフィールド） ===== */}
      <main
        className={`table-felt relative z-0 mx-3 my-1.5 flex min-h-0 flex-1 flex-col items-center justify-between rounded-2xl px-3 py-2 ${
          state.phase === 'reveal' || state.phase === 'cpuThinking' ? 'heartbeat-glow' : ''
        }`}
        style={{ ['--beat' as string]: `${beatSec}s` }}
      >
        {/* CPU の札 */}
        <div className="relative flex flex-col items-center">
          <span className="absolute -left-14 top-1 text-[10px] tracking-[0.3em] text-red-300/80">CPU</span>
          <Slot>
            {state.cpuPlayed && (
              <motion.div
                key={`cpu-played-${state.setNo}-${state.turn}`}
                initial={{ y: -60, opacity: 0, scale: 0.6 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              >
                <Card type={state.cpuPlayed} faceUp={state.revealed} className="h-[14dvh]" />
              </motion.div>
            )}
          </Slot>
        </div>

        {/* 中央ステータス */}
        <div className="pointer-events-none flex h-8 items-center justify-center text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={statusText}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`text-sm font-bold tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${
                state.phase === 'reveal' ? (state.revealed ? 'gold-text text-2xl' : 'animate-pulse text-red-200') : 'text-gold-light/90'
              }`}
              style={{ fontFamily: 'var(--font-serif-jp)' }}
            >
              {statusText}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* プレイヤーの札 */}
        <div className="relative flex flex-col items-center">
          <span className="absolute -right-14 bottom-1 text-[10px] tracking-[0.3em] text-gold/80">YOU</span>
          <Slot>
            {state.playerPlayed && (
              <motion.div
                key={`you-played-${state.setNo}-${state.turn}`}
                initial={{ y: 60, opacity: 0, scale: 0.6 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              >
                <Card type={state.playerPlayed} faceUp={state.revealed} className="h-[14dvh]" />
              </motion.div>
            )}
          </Slot>
        </div>
      </main>

      {/* ===== プレイヤー手札 ===== */}
      <footer className="relative z-10 flex flex-col items-center gap-2 px-3 pb-3 pt-1">
        <div className="flex items-end justify-center gap-1.5">
          <AnimatePresence initial={false}>
            {state.playerHand.map((card, i) => (
              <motion.div
                key={`hand-${state.setNo}-${state.turn}-${i}`}
                layout
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              >
                <Card
                  type={card}
                  faceUp
                  className="h-[min(14dvh,25vw)]"
                  selected={state.selectedIdx === i}
                  dimmed={!canSelect}
                  onClick={
                    canSelect
                      ? () => {
                          // 選択済みカードをもう一度タップ → 確定（2回タップ）
                          if (state.selectedIdx === i) confirmCard()
                          else selectCard(i)
                        }
                      : undefined
                  }
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
              : 'border-white/10 bg-black/40 text-white/35'
          }`}
        >
          {canSelect
            ? state.selectedIdx !== null
              ? 'このカードを出す'
              : 'カードをタップして選択'
            : state.phase === 'reveal'
              ? '……'
              : '待て……'}
        </motion.button>
      </footer>

      {/* ===== オーバーレイ ===== */}
      <AnimatePresence>
        {state.phase === 'setIntro' && (
          <motion.div
            key="intro"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm"
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
              playerWins={playerWins}
              cpuWins={cpuWins}
              matchDecided={matchDecided}
              onNext={state.phase === 'turnResult' ? nextTurn : nextSet}
            />
          )}

        {state.phase === 'matchOver' && (
          <MatchOverlay key="match" playerWon={playerWins >= WIN_TARGET} history={state.history} onRestart={restart} />
        )}
      </AnimatePresence>
    </div>
  )
}

/** 場のカード置き場。空のときは破線枠を描く */
function Slot({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-[14dvh] aspect-[2/3] items-center justify-center">
      <div className="absolute inset-0 rounded-[6%] border-2 border-dashed border-gold/25" />
      <AnimatePresence>{children}</AnimatePresence>
    </div>
  )
}
