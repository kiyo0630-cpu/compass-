import { useOptionalImage } from './useOptionalImage'

/** 最終勝利：莫大な地下財宝 */
export function TreasureArt({ className = '' }: { className?: string }) {
  const img = useOptionalImage('win_treasure.png')
  if (img) return <img src={img} alt="地下財宝" className={`${className} object-cover`} draggable={false} />
  return (
    <svg viewBox="0 0 400 520" className={className} preserveAspectRatio="xMidYMid slice" aria-label="地下財宝">
      <defs>
        <radialGradient id="tr-sky" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#4a2e0a" />
          <stop offset="0.5" stopColor="#1a1006" />
          <stop offset="1" stopColor="#060402" />
        </radialGradient>
        <radialGradient id="tr-light" cx="50%" cy="56%" r="45%">
          <stop offset="0" stopColor="rgba(255,230,140,0.95)" />
          <stop offset="0.4" stopColor="rgba(255,190,70,0.5)" />
          <stop offset="1" stopColor="rgba(255,190,70,0)" />
        </radialGradient>
        <linearGradient id="tr-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b8" />
          <stop offset="0.5" stopColor="#e6b84c" />
          <stop offset="1" stopColor="#8a5f14" />
        </linearGradient>
        <linearGradient id="tr-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a3a1a" />
          <stop offset="1" stopColor="#2a140a" />
        </linearGradient>
      </defs>
      <rect width="400" height="520" fill="url(#tr-sky)" />
      {/* 洞窟の壁 */}
      <path d="M0 0h400v140q-40 40-90 20-60-30-120 0-50 30-100-10-40-30-90 0z" fill="#0d0905" />
      <path d="M0 0v300q30-60 20-140 20-60-20-160z" fill="#0d0905" />
      <path d="M400 0v320q-30-70-20-150-20-60 20-170z" fill="#0d0905" />
      {/* 光条 */}
      <g opacity="0.55">
        {Array.from({ length: 14 }).map((_, i) => {
          const a = (i / 14) * Math.PI * 2
          return (
            <polygon key={i} points={`200,300 ${200 + Math.cos(a) * 420},${300 + Math.sin(a) * 420} ${200 + Math.cos(a + 0.12) * 420},${300 + Math.sin(a + 0.12) * 420}`} fill="rgba(255,220,120,0.08)" />
          )
        })}
      </g>
      <circle cx="200" cy="300" r="220" fill="url(#tr-light)" />
      {/* 金貨の山 */}
      <ellipse cx="200" cy="440" rx="210" ry="70" fill="url(#tr-gold)" />
      <ellipse cx="200" cy="400" rx="160" ry="50" fill="url(#tr-gold)" />
      <ellipse cx="200" cy="370" rx="110" ry="40" fill="url(#tr-gold)" />
      {Array.from({ length: 60 }).map((_, i) => {
        const x = 40 + ((i * 97) % 320)
        const y = 350 + ((i * 53) % 150)
        return <ellipse key={i} cx={x} cy={y} rx="9" ry="4" fill="none" stroke="#8a5f14" strokeWidth="1" opacity="0.6" />
      })}
      {/* 宝箱 */}
      <rect x="130" y="300" width="140" height="70" rx="6" fill="url(#tr-wood)" stroke="#e6b84c" strokeWidth="3" />
      <path d="M130 300q70-50 140 0z" fill="#4a2410" stroke="#e6b84c" strokeWidth="3" />
      <rect x="190" y="320" width="20" height="26" rx="3" fill="url(#tr-gold)" />
      <ellipse cx="200" cy="300" rx="70" ry="14" fill="rgba(255,240,180,0.9)" />
      {/* 宝石 */}
      <polygon points="90,392 104,378 118,392 104,412" fill="#ff4a6a" opacity="0.9" />
      <polygon points="300,382 316,368 332,382 316,402" fill="#3ad1ff" opacity="0.9" />
      <polygon points="260,420 274,408 288,420 274,436" fill="#7cff6a" opacity="0.9" />
      {/* 王冠と杯 */}
      <path d="M44 350l8-26 12 16 8-28 8 28 12-16 8 26z" fill="url(#tr-gold)" />
      <path d="M330 420q-20-30 0-60h40q20 30 0 60z" fill="url(#tr-gold)" />
      {/* 舞う金粉 */}
      {Array.from({ length: 40 }).map((_, i) => {
        const x = (i * 83) % 400
        const y = (i * 131) % 330
        return <circle key={i} cx={x} cy={y} r={1 + (i % 3)} fill="#fff2b8" opacity={0.3 + ((i % 5) * 0.12)} />
      })}
    </svg>
  )
}

/** 最終敗北：地下牢 */
export function DungeonArt({ className = '' }: { className?: string }) {
  const img = useOptionalImage('lose_dungeon.png')
  if (img) return <img src={img} alt="地下牢" className={`${className} object-cover`} draggable={false} />
  return (
    <svg viewBox="0 0 400 520" className={className} preserveAspectRatio="xMidYMid slice" aria-label="地下牢">
      <defs>
        <radialGradient id="dg-bg" cx="50%" cy="30%" r="80%">
          <stop offset="0" stopColor="#2a1016" />
          <stop offset="0.6" stopColor="#0d0608" />
          <stop offset="1" stopColor="#030102" />
        </radialGradient>
        <linearGradient id="dg-iron" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1a1a1a" />
          <stop offset="0.4" stopColor="#5a5a5a" />
          <stop offset="0.6" stopColor="#2a2a2a" />
          <stop offset="1" stopColor="#0a0a0a" />
        </linearGradient>
        <linearGradient id="dg-blood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b01a2e" />
          <stop offset="1" stopColor="#3a0810" />
        </linearGradient>
        <radialGradient id="dg-torch" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="rgba(255,140,40,0.55)" />
          <stop offset="1" stopColor="rgba(255,140,40,0)" />
        </radialGradient>
      </defs>
      <rect width="400" height="520" fill="url(#dg-bg)" />
      {/* 石壁 */}
      {Array.from({ length: 14 }).map((_, r) =>
        Array.from({ length: 6 }).map((_, c) => {
          const off = r % 2 ? 35 : 0
          return (
            <rect key={`${r}-${c}`} x={c * 70 - off} y={r * 40} width="66" height="36" rx="3" fill="#160a0e" stroke="#2a141a" strokeWidth="1.5" />
          )
        }),
      )}
      {/* 松明の灯り */}
      <circle cx="330" cy="90" r="120" fill="url(#dg-torch)" />
      <rect x="326" y="90" width="8" height="50" fill="#3a2410" />
      <path d="M330 60q-14 18 0 34 14-16 0-34z" fill="#ff8c2a" />
      <path d="M330 70q-6 9 0 17 6-8 0-17z" fill="#ffe08a" />
      {/* 血の飛沫・滴り */}
      <path d="M60 0q-10 60 0 120 8-60 0-120z" fill="url(#dg-blood)" opacity="0.85" />
      <path d="M120 0q-6 40 0 80 6-40 0-80z" fill="url(#dg-blood)" opacity="0.7" />
      <circle cx="90" cy="430" r="26" fill="url(#dg-blood)" opacity="0.7" />
      <circle cx="130" cy="455" r="12" fill="url(#dg-blood)" opacity="0.7" />
      <circle cx="60" cy="470" r="8" fill="url(#dg-blood)" opacity="0.7" />
      {/* うずくまる囚人 */}
      <path d="M150 440q0-60 50-80 50 20 50 80z" fill="#1c1a1a" />
      <ellipse cx="200" cy="356" rx="22" ry="24" fill="#7a5a48" />
      <path d="M178 350q22-18 44 0" fill="#141010" />
      {/* 鎖 */}
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={i} cx={240 + i * 18} cy={400 + i * 10} rx="7" ry="10" fill="none" stroke="#7a7a7a" strokeWidth="3" transform={`rotate(-30 ${240 + i * 18} ${400 + i * 10})`} />
      ))}
      <rect x="320" y="440" width="36" height="20" rx="4" fill="#4a4a4a" />
      {/* 床 */}
      <rect x="0" y="470" width="400" height="50" fill="#0a0507" />
      {/* 鉄格子（手前） */}
      {[40, 100, 160, 220, 280, 340].map((x) => (
        <rect key={x} x={x - 7} y="0" width="14" height="520" fill="url(#dg-iron)" />
      ))}
      <rect x="0" y="120" width="400" height="16" fill="url(#dg-iron)" />
      <rect x="0" y="330" width="400" height="16" fill="url(#dg-iron)" />
      {/* 錠前 */}
      <rect x="180" y="300" width="40" height="34" rx="6" fill="#2a2a2a" stroke="#6a6a6a" strokeWidth="2" />
      <path d="M190 300v-10a10 10 0 0120 0v10" fill="none" stroke="#6a6a6a" strokeWidth="4" />
      <circle cx="200" cy="318" r="5" fill="#0a0a0a" />
    </svg>
  )
}
