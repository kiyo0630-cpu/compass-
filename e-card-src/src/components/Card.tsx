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
}

/**
 * 3D フリップ対応カード。faceUp を切り替えると Y 軸回転で表裏が入れ替わる。
 * type が null のときは裏面のみを描く（相手の伏せ札）。
 */
export function Card({ type, faceUp, className = '', selected, dimmed, onClick, glow = null }: CardProps) {
  const shadow =
    glow === 'gold'
      ? '0 0 28px 6px rgba(227,183,78,0.55)'
      : glow === 'blood'
        ? '0 0 28px 6px rgba(155,28,46,0.6)'
        : selected
          ? '0 14px 30px rgba(0,0,0,0.7), 0 0 18px 2px rgba(227,183,78,0.45)'
          : '0 8px 20px rgba(0,0,0,0.65)'

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`perspective relative block aspect-[2/3] shrink-0 ${className} ${onClick ? 'cursor-pointer' : 'cursor-default'} ${dimmed ? 'opacity-40' : ''}`}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      animate={{ y: selected ? -18 : 0, scale: selected ? 1.06 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      style={{ touchAction: 'manipulation' }}
    >
      <motion.div
        className="preserve-3d relative h-full w-full rounded-[6%]"
        animate={{ rotateY: faceUp ? 0 : 180 }}
        transition={{ duration: 0.75, ease: [0.2, 0.8, 0.2, 1] }}
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
