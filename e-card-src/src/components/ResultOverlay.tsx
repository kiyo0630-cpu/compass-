import { motion } from 'framer-motion'
import type { CardType, Outcome } from '../game/types'
import { CARD_LABEL } from '../game/logic'
import { Card } from './Card'
import { AngelIcon, DemonIcon } from '../art/Icons'

interface Props {
  kind: 'turn' | 'set'
  outcome: Outcome
  playerCard: CardType
  cpuCard: CardType
  turn: number
  setNo: number
  playerWins: number
  cpuWins: number
  matchDecided: boolean
  onNext: () => void
}

const TITLE: Record<Outcome, { main: string; sub: string; cls: string }> = {
  win: { main: 'あなたの勝利！', sub: 'YOU WIN THIS SET', cls: 'gold-text' },
  lose: { main: 'あなたの敗北...', sub: 'YOU LOSE THIS SET', cls: 'blood-text' },
  draw: { main: '引き分け', sub: 'DRAW', cls: 'text-white/80' },
}

/**
 * ターン引き分け／セット決着時のオーバーレイ。
 * 場のカードが消えて結果が分からなくならないよう、両者のカードを大きく並べて表示する。
 */
export function ResultOverlay({
  kind,
  outcome,
  playerCard,
  cpuCard,
  turn,
  setNo,
  playerWins,
  cpuWins,
  matchDecided,
  onNext,
}: Props) {
  const t = TITLE[outcome]
  const isSetDraw = kind === 'set' && outcome === 'draw'
  const nextLabel = matchDecided ? '最終結果を見る' : kind === 'turn' ? '次のターンへ' : '次のセットへ（陣営交代）'

  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 px-5 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* 天使／悪魔の演出 */}
      {kind === 'set' && outcome === 'win' && (
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_30%,rgba(227,183,78,0.35),transparent_70%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.7] }}
          transition={{ duration: 1.2 }}
        />
      )}
      {kind === 'set' && outcome === 'lose' && (
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_30%,rgba(155,28,46,0.45),transparent_70%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.8] }}
          transition={{ duration: 1.2 }}
        />
      )}

      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
        className="relative flex w-full flex-col items-center"
      >
        <p className="text-[11px] tracking-[0.3em] text-white/50">
          SET {setNo} ／ TURN {turn}
        </p>

        <div className="mt-1 flex items-center gap-3">
          {kind === 'set' && outcome === 'win' && <AngelIcon className="h-14 w-14" />}
          {kind === 'set' && outcome === 'lose' && <DemonIcon className="h-14 w-14" />}
          <h2
            className={`${t.cls} whitespace-nowrap text-center text-[clamp(1.6rem,8.5vw,2.6rem)] font-black leading-none`}
            style={{ fontFamily: 'var(--font-serif-jp)' }}
          >
            {isSetDraw ? '引き分け' : t.main}
          </h2>
        </div>
        <p className="mt-1 text-xs tracking-[0.3em] text-white/50">{isSetDraw ? 'SET DRAW ─ 5ターン決着なし' : t.sub}</p>

        {/* お互いのカード */}
        <div className="mt-5 flex w-full items-end justify-center gap-5">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] tracking-widest text-red-300">CPU</span>
            <Card type={cpuCard} faceUp className="w-[32vw] max-w-[140px]" glow={outcome === 'lose' ? 'blood' : null} />
            <span className="text-sm font-bold text-white/85">{CARD_LABEL[cpuCard].ja}</span>
          </div>
          <div className="pb-7 text-2xl font-black text-white/40">VS</div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] tracking-widest text-gold">YOU</span>
            <Card type={playerCard} faceUp className="w-[32vw] max-w-[140px]" glow={outcome === 'win' ? 'gold' : null} />
            <span className="text-sm font-bold text-white/85">{CARD_LABEL[playerCard].ja}</span>
          </div>
        </div>

        {kind === 'set' && (
          <p className="mt-4 text-sm text-white/70">
            現在 <span className="gold-text font-bold">YOU {playerWins}</span>
            <span className="mx-2 text-white/40">-</span>
            <span className="blood-text font-bold">{cpuWins} CPU</span>
          </p>
        )}
        {kind === 'turn' && (
          <p className="mt-4 text-xs text-white/60">市民同士 ─ カードを破棄して次のターンへ</p>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onNext}
          className="mt-5 w-full max-w-xs rounded-xl border border-gold/70 bg-gradient-to-b from-gold-dark/60 to-black/80 py-3.5 text-base font-bold tracking-wider text-gold-light shadow-[0_0_24px_rgba(227,183,78,0.25)]"
        >
          {nextLabel}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
