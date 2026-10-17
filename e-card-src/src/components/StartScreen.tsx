import { motion } from 'framer-motion'
import { Crown, Link2, Volume2, VolumeX } from 'lucide-react'
import type { Side } from '../game/types'
import { KingArt, SlaveArt } from '../art/CardArt'

interface Props {
  onChoose: (side: Side) => void
  muted: boolean
  onToggleMute: () => void
}

export function StartScreen({ onChoose, muted, onToggleMute }: Props) {
  return (
    <div className="gamble-bg safe-top safe-bottom relative mx-auto flex h-[100dvh] max-w-md flex-col items-center justify-between overflow-hidden px-5 py-6">
      <button
        type="button"
        onClick={onToggleMute}
        className="absolute right-4 top-4 z-10 rounded-full border border-gold/40 bg-black/50 p-2 text-gold"
        aria-label={muted ? 'ミュート解除' : 'ミュート'}
        style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 mt-6 text-center"
      >
        <p className="text-[11px] tracking-[0.5em] text-gold/70">EMPEROR CARD</p>
        <h1 className="gold-text mt-1 text-6xl font-black leading-none" style={{ fontFamily: 'var(--font-serif-jp)' }}>
          Eカード
        </h1>
        <p className="mt-3 text-xs leading-relaxed text-white/60">
          5勝先取 ─ 1セットごとに陣営交代
          <br />
          先に5勝した者だけが地上に戻れる
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="relative z-10 w-full"
      >
        <p className="mb-3 text-center text-sm tracking-widest text-gold-light">最初の陣営を選べ</p>
        <div className="grid grid-cols-2 gap-3">
          <SideButton side="king" onChoose={onChoose} />
          <SideButton side="slave" onChoose={onChoose} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        className="relative z-10 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-white/60"
      >
        <p className="mb-1 font-bold text-gold/80">ルール</p>
        <p>王様 ＞ 市民 ／ 市民 ＞ 奴隷 ／ 奴隷 ＞ 王様</p>
        <p>市民同士は引き分けで次ターンへ。最大5ターン。</p>
        <p>毎ターン奴隷側が先に伏せ、王様側が後に伏せる。</p>
      </motion.div>
    </div>
  )
}

function SideButton({ side, onChoose }: { side: Side; onChoose: (s: Side) => void }) {
  const isKing = side === 'king'
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={() => onChoose(side)}
      className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 ${
        isKing
          ? 'border-gold/70 bg-gradient-to-b from-blood-dark/70 to-black/70'
          : 'border-emerald-900/80 bg-gradient-to-b from-emerald-950/70 to-black/70'
      }`}
    >
      <div className="aspect-[2/3] w-[min(6rem,13dvh)] overflow-hidden rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.7)]">
        {isKing ? <KingArt /> : <SlaveArt />}
      </div>
      <div className="flex items-center gap-1.5 text-base font-bold">
        {isKing ? <Crown size={16} className="text-gold" /> : <Link2 size={16} className="text-emerald-400" />}
        <span className={isKing ? 'text-gold-light' : 'text-emerald-200'}>{isKing ? '王様側' : '奴隷側'}</span>
      </div>
      <p className="whitespace-pre-line text-[10px] leading-tight text-white/50">
        {isKing ? '王様1枚＋市民4枚\n後攻で出す' : '奴隷1枚＋市民4枚\n先攻で出す'}
      </p>
    </motion.button>
  )
}
