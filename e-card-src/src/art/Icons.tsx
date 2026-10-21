import { useOptionalImage } from './useOptionalImage'

/** 黄金の天使（勝利） */
export function AngelIcon({ className = '' }: { className?: string }) {
  const img = useOptionalImage('angel.png')
  if (img) return <img src={img} alt="天使" className={`${className} object-contain`} draggable={false} />
  return (
    <svg viewBox="0 0 64 64" className={className} aria-label="天使">
      <defs>
        <linearGradient id="angel-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="0.5" stopColor="#e3b74e" />
          <stop offset="1" stopColor="#9a6f1c" />
        </linearGradient>
        <radialGradient id="angel-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="rgba(255,236,170,0.9)" />
          <stop offset="1" stopColor="rgba(255,236,170,0)" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#angel-halo)" />
      {/* 翼 */}
      <path d="M30 34C22 20 10 18 4 24c6 2 8 6 8 10-4 0-6 2-8 6 6-2 12 0 16 4 2-4 6-8 10-10z" fill="url(#angel-gold)" />
      <path d="M34 34c8-14 20-16 26-10-6 2-8 6-8 10 4 0 6 2 8 6-6-2-12 0-16 4-2-4-6-8-10-10z" fill="url(#angel-gold)" />
      {/* 光輪 */}
      <ellipse cx="32" cy="14" rx="9" ry="3" fill="none" stroke="#fff3c2" strokeWidth="2" />
      {/* 頭と身体 */}
      <circle cx="32" cy="23" r="6" fill="#fff0d0" />
      <path d="M24 50c0-12 4-18 8-18s8 6 8 18z" fill="url(#angel-gold)" />
      <path d="M26 50h12" stroke="#9a6f1c" strokeWidth="2" />
    </svg>
  )
}

/** 血色の悪魔（敗北） */
export function DemonIcon({ className = '' }: { className?: string }) {
  const img = useOptionalImage('demon.png')
  if (img) return <img src={img} alt="悪魔" className={`${className} object-contain`} draggable={false} />
  return (
    <svg viewBox="0 0 64 64" className={className} aria-label="悪魔">
      <defs>
        <linearGradient id="demon-blood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff5a6b" />
          <stop offset="0.5" stopColor="#9b1c2e" />
          <stop offset="1" stopColor="#3a0810" />
        </linearGradient>
        <radialGradient id="demon-aura" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="rgba(155,28,46,0.7)" />
          <stop offset="1" stopColor="rgba(155,28,46,0)" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#demon-aura)" />
      {/* 角 */}
      <path d="M20 26c-6-6-8-14-4-20 2 8 6 12 10 14z" fill="url(#demon-blood)" />
      <path d="M44 26c6-6 8-14 4-20-2 8-6 12-10 14z" fill="url(#demon-blood)" />
      {/* 顔 */}
      <path d="M18 28c0-8 6-12 14-12s14 4 14 12c0 10-4 16-6 22l-8 6-8-6c-2-6-6-12-6-22z" fill="#2a0810" stroke="url(#demon-blood)" strokeWidth="2" />
      {/* 眼 */}
      <path d="M22 30l8 3-8 3z" fill="#ff3b4e" />
      <path d="M42 30l-8 3 8 3z" fill="#ff3b4e" />
      {/* 牙 */}
      <path d="M24 44h16l-2 4-3-3-3 5-3-5-3 3z" fill="#f0e6d6" />
      {/* 血滴 */}
      <path d="M48 46c0 4-4 8-4 12a4 4 0 008 0c0-4-4-8-4-12z" fill="url(#demon-blood)" />
    </svg>
  )
}
