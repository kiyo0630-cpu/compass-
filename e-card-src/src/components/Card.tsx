import { motion } from 'framer-motion'
import type { CardType } from '../game/types'
import { CardBack, CardFace } from '../art/CardArt'

interface CardProps {
  type?: CardType | null
  faceUp: boolean
  className?: string
  selected?: boolean
  dimmed?: boolean
  onClick?: () => void
  glow?: 'gold' | 'blood' | null
  /** 伏せたまま端がじわりと持ち上がる（オープン直前のタメ） */
  peek?: boolean
}

/**
 * 3D フリップ対応カード。faceUp を切り替えると Y 軸回転で表裏が入れ替わる。
 * type が null のときは裏面のみを描く（相手の伏せ札）。
 */
export function Card({ type, faceUp, className = '', selected, dimmed, onClick, glow = null, peek = false }: CardProps) {
  const shadow =
    glow === 'gold'
      ? '0 0 28px 6px rgba(227,183,78,0.55)'
      : glow === 'blood'
        ? '0 0 28px 6px rgba(155,28,46,0.6)'
        : selected
          ? '0 14px 30px rgba(0,0,0,0.7), 0 0 18px 2px rgba(227,183,78,0.45)'
          : '0 8px 20px rgba(0,0,0,0.65)'

  const lifting = peek && !faceUp
  const rotateY = faceUp ? 0 : lifting ? 154 : 180
  const flipTransition = faceUp
    ? // スローモーション気味に溜めてから一気にめくれる
      { duration: 1.0, ease: [0.7, 0, 0.25, 1] as const }
    : lifting
      ? { duration: 1.45, ease: [0.3, 0, 0.9, 0.7] as const }
      : { duration: 0.4 }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`perspective relative block aspect-[2/3] shrink-0 ${className} ${onClick ? 'cursor-pointer' : 'cursor-default'} ${dimmed ? 'opacity-40' : ''}`}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      initial={false}
      animate={{ y: selected ? -18 : lifting ? -4 : 0, scale: selected ? 1.06 : lifting ? 1.05 : 1 }}
      transition={lifting ? { duration: 1.45, ease: 'easeOut' } : { type: 'spring', stiffness: 400, damping: 26 }}
    >
      <motion.div
        className="preserve-3d relative h-full w-full rounded-[6%]"
        // initial={false}: マウント時に表→裏へ回る途中で表面が見えてしまうのを防ぐ
        initial={false}
        animate={{ rotateY }}
        transition={flipTransition}
        style={{ boxShadow: shadow, borderRadius: '6%' }}
      >
        <div className="backface-hidden absolute inset-0 overflow-hidden rounded-[6%]">
          {type ? <CardFace type={type} /> : <CardBack />}
        </div>
        <div
          className="backface-hidden absolute inset-0 overflow-hidden rounded-[6%]"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <CardBack />
        </div>
      </motion.div>
    </motion.button>
  )
}
