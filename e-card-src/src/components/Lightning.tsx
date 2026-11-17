import { motion } from 'framer-motion'

/** 王様 vs 奴隷の激突時に走る赤い閃光と稲妻 */
export function Lightning() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-[25]"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0.25, 0.95, 0.15, 0.6, 0] }}
      transition={{ duration: 1.1, times: [0, 0.04, 0.14, 0.2, 0.38, 0.5, 1], ease: 'linear' }}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_48%,rgba(255,60,80,0.75),rgba(140,0,20,0.55)_55%,rgba(40,0,6,0.35)_100%)] mix-blend-screen" />
      <svg viewBox="0 0 100 180" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <filter id="bolt-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#bolt-glow)" fill="none" strokeLinejoin="bevel">
          <polyline points="58,0 46,34 56,40 40,78 52,84 44,112" stroke="#ff9aa8" strokeWidth="2.6" />
          <polyline points="58,0 46,34 56,40 40,78 52,84 44,112" stroke="#ffffff" strokeWidth="1" />
          <polyline points="56,40 70,58 64,62 76,86" stroke="#ffd0d6" strokeWidth="1.2" />
          <polyline points="40,78 26,96 32,100 20,126" stroke="#ffd0d6" strokeWidth="1.2" />
          <polyline points="30,180 40,150 34,146 46,118" stroke="#ff9aa8" strokeWidth="2" />
          <polyline points="30,180 40,150 34,146 46,118" stroke="#ffffff" strokeWidth="0.8" />
        </g>
      </svg>
    </motion.div>
  )
}
