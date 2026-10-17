import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import type { Outcome } from '../game/types'
import { TreasureArt, DungeonArt } from '../art/Endings'
import { AngelIcon, DemonIcon } from '../art/Icons'

interface Props {
  playerWon: boolean
  history: Outcome[]
  onRestart: () => void
}

/** 5 勝到達時の MATCH OVER 画面 */
export function MatchOverlay({ playerWon, history, onRestart }: Props) {
  const playerWins = history.filter((h) => h === 'win').length
  const cpuWins = history.filter((h) => h === 'lose').length

  return (
    <motion.div
      className="absolute inset-0 z-40 overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.15, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 2.2, ease: 'easeOut' }}
      >
        {playerWon ? <TreasureArt className="h-full w-full" /> : <DungeonArt className="h-full w-full" />}
      </motion.div>

      {playerWon && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_55%,rgba(255,235,160,0.55),transparent_70%)]"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
      )}
      {!playerWon && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_50%,transparent_40%,rgba(80,0,10,0.75)_100%)]"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      )}

      <div className="safe-top safe-bottom relative flex h-full flex-col items-center justify-between px-5 py-8">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="text-center"
        >
          <p className="text-xs tracking-[0.5em] text-white/70 drop-shadow">MATCH OVER</p>
          <div className="mt-2 flex items-center justify-center gap-3">
            {playerWon ? <AngelIcon className="h-16 w-16" /> : <DemonIcon className="h-16 w-16" />}
            <h2
              className={`${playerWon ? 'gold-text' : 'blood-text'} whitespace-nowrap text-[clamp(2rem,11vw,3rem)] font-black leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]`}
              style={{ fontFamily: 'var(--font-serif-jp)' }}
            >
              {playerWon ? '完全勝利' : '地下行き'}
              <br />
              <span className="text-3xl">{playerWon ? '大逆転！' : '決定...'}</span>
            </h2>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="w-full rounded-xl border border-white/15 bg-black/65 p-4 text-center backdrop-blur-sm"
        >
          <p className="whitespace-pre-line text-sm leading-relaxed text-white/85">
            {playerWon
              ? '莫大な地下財宝はあなたのものだ。\n悪魔の囁きを退け、天使が微笑んだ。'
              : '鉄格子が閉まる音が響く。\n次に地上の光を見るのはいつになるか...'}
          </p>
          <p className="mt-3 text-2xl font-black">
            <span className="gold-text">YOU {playerWins}</span>
            <span className="mx-3 text-white/40">-</span>
            <span className="blood-text">{cpuWins} CPU</span>
          </p>
          <p className="mt-1 text-[11px] text-white/50">全 {history.length} セット</p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={onRestart}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gold/70 bg-gradient-to-b from-gold-dark/60 to-black/80 py-3.5 text-base font-bold tracking-wider text-gold-light"
          >
            <RotateCcw size={18} />
            もう一度挑む
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  )
}
