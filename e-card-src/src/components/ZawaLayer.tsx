import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface Zawa {
  id: number
  left: number
  top: number
  size: number
  rot: number
  dur: number
  drift: number
  red: boolean
}

function makeZawa(id: number): Zawa {
  const onLeft = Math.random() < 0.5
  return {
    id,
    // 中央のカードに被らないよう、画面の左右の端から湧かせる
    left: onLeft ? 1 + Math.random() * 13 : 70 + Math.random() * 14,
    top: 14 + Math.random() * 66,
    size: 15 + Math.random() * 13,
    rot: -14 + Math.random() * 28,
    dur: 2.2 + Math.random() * 1.2,
    drift: (onLeft ? 1 : -1) * (4 + Math.random() * 14),
    red: Math.random() < 0.3,
  }
}

/**
 * 「ざわ… ざわ…」が煙のように浮かんで消える演出。
 * intensity が 0 のときは何も出さず、大きいほど湧く間隔が短くなる。
 */
export function ZawaLayer({ intensity }: { intensity: number }) {
  const [items, setItems] = useState<Zawa[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    if (intensity <= 0) return
    const spawn = () => setItems((prev) => [...prev.slice(-7), makeZawa(idRef.current++)])
    const first = window.setTimeout(spawn, 120)
    const iv = window.setInterval(spawn, Math.max(380, 1500 / intensity))
    return () => {
      window.clearTimeout(first)
      window.clearInterval(iv)
    }
  }, [intensity])

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {items.map((z) => (
          <motion.span
            key={z.id}
            className={`absolute whitespace-nowrap font-black ${z.red ? 'text-red-300' : 'text-white'}`}
            style={{
              left: `${z.left}%`,
              top: `${z.top}%`,
              fontSize: z.size,
              rotate: z.rot,
              fontFamily: 'var(--font-serif-jp)',
              textShadow: '0 0 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)',
            }}
            initial={{ opacity: 0, y: 12, x: 0, scale: 0.8, filter: 'blur(3px)' }}
            animate={{
              opacity: [0, 0.75, 0.55, 0],
              y: -46,
              x: z.drift,
              scale: 1.18,
              filter: ['blur(3px)', 'blur(0px)', 'blur(0.5px)', 'blur(4px)'],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: z.dur, ease: 'easeOut', times: [0, 0.25, 0.6, 1] }}
            onAnimationComplete={() => setItems((prev) => prev.filter((i) => i.id !== z.id))}
          >
            ざわ…
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}
