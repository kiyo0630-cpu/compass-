import { motion } from 'framer-motion'
import { Crown, Link2, Vibrate, VibrateOff, Volume2, VolumeX } from 'lucide-react'
import type { Side } from '../game/types'
import { KingArt, SlaveArt } from '../art/CardArt'

interface Props {
  onChoose: (side: Side) => void
  muted: boolean
  onToggleMute: () => void
  /** 振動に対応している端末かどうか。非対応ならボタンを出さない */
  hapticsAvailable: boolean
  hapticsOn: boolean
  onToggleHaptics: () => void
  bonusMode: boolean
  onToggleBonus: () => void
}

export function StartScreen({
  onChoose,
  muted,
  onToggleMute,
  hapticsAvailable,
  hapticsOn,
  onToggleHaptics,
  bonusMode,
  onToggleBonus,
}: Props) {
  return (
    <div className="gamble-bg safe-top safe-bottom relative mx-auto h-[100dvh] max-w-md overflow-hidden">
      {/* safe-area の余白は外側、画面内の余白は内側で持つ（同じ要素に置くと上書きし合う） */}
      <div className="relative flex h-full flex-col items-center justify-between px-5 py-4">
      <div
        className="absolute right-4 top-4 z-10 flex gap-2"
        style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {hapticsAvailable && (
          <button
            type="button"
            onClick={onToggleHaptics}
            className="rounded-full border border-gold/40 bg-black/50 p-2 text-gold"
            aria-label={hapticsOn ? '振動をオフ' : '振動をオン'}
          >
            {hapticsOn ? <Vibrate size={18} /> : <VibrateOff size={18} />}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleMute}
          className="rounded-full border border-gold/40 bg-black/50 p-2 text-gold"
          aria-label={muted ? 'ミュート解除' : 'ミュート'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 mt-4 text-center"
      >
        <p className="text-[11px] tracking-[0.5em] text-gold/70">EMPEROR CARD</p>
        <h1
          className="gold-text mt-1 text-[clamp(2.6rem,9.5dvh,3.75rem)] font-black leading-none"
          style={{ fontFamily: 'var(--font-serif-jp)' }}
        >
          Eカード
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-white/60">
          5勝先取 ─ 1セットごとに陣営交代
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="relative z-10 w-full"
      >
        <p className="mb-2 text-center text-sm tracking-widest text-gold-light">最初の陣営を選べ</p>
        <div className="grid grid-cols-2 gap-3">
          <SideButton side="king" onChoose={onChoose} />
          <SideButton side="slave" onChoose={onChoose} bonus={bonusMode} />
        </div>

        {/* 奴隷ボーナス（倍率）モード */}
        <button
          type="button"
          role="switch"
          aria-checked={bonusMode}
          onClick={onToggleBonus}
          className={`mt-2.5 flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
            bonusMode ? 'border-gold/80 bg-gold/10' : 'border-white/15 bg-black/40'
          }`}
        >
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${bonusMode ? 'bg-gold' : 'bg-white/20'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                bonusMode ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </span>
          <span className="min-w-0">
            <span className={`block text-sm font-bold ${bonusMode ? 'text-gold-light' : 'text-white/80'}`}>
              奴隷ボーナス
            </span>
            <span className="block text-[10px] leading-tight text-white/55">
              奴隷側で王を討つと一気に2勝分（CPUも同条件）
            </span>
          </span>
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        className="relative z-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[10.5px] leading-relaxed text-white/60"
      >
        <p>王様 ＞ 市民 ／ 市民 ＞ 奴隷 ／ 奴隷 ＞ 王様</p>
        <p>奴隷側が先に伏せる。市民同士は引き分け（最大5ターン）</p>
        <p>CPUの表情は本音とは限らない。上スワイプでも出せる</p>
      </motion.div>
      </div>
    </div>
  )
}

function SideButton({ side, onChoose, bonus = false }: { side: Side; onChoose: (s: Side) => void; bonus?: boolean }) {
  const isKing = side === 'king'
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={() => onChoose(side)}
      className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 ${
        isKing
          ? 'border-gold/70 bg-gradient-to-b from-blood-dark/70 to-black/70'
          : 'border-emerald-900/80 bg-gradient-to-b from-emerald-950/70 to-black/70'
      }`}
    >
      {bonus && (
        <span className="absolute -right-1.5 -top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-black text-black shadow">
          勝てば×2
        </span>
      )}
      <div className="aspect-[2/3] w-[min(6rem,11dvh)] overflow-hidden rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.7)]">
        {isKing ? <KingArt /> : <SlaveArt />}
      </div>
      <div className="flex items-center gap-1.5 text-base font-bold">
        {isKing ? <Crown size={16} className="text-gold" /> : <Link2 size={16} className="text-emerald-400" />}
        <span className={isKing ? 'text-gold-light' : 'text-emerald-200'}>{isKing ? '王様側' : '奴隷側'}</span>
      </div>
      <p className="text-[10px] leading-tight text-white/50">
        {isKing ? '王様1枚＋市民4枚・後攻' : '奴隷1枚＋市民4枚・先攻'}
      </p>
    </motion.button>
  )
}
