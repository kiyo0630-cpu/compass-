import type { CardType } from '../game/types'
import { useOptionalImage } from './useOptionalImage'

/* ---------- 共通：タロット枠 ---------- */
function Frame({
  id,
  children,
  from,
  to,
}: {
  id: string
  children: React.ReactNode
  from: string
  to: string
}) {
  return (
    <svg viewBox="0 0 200 300" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e3a3" />
          <stop offset="0.5" stopColor="#c9a24a" />
          <stop offset="1" stopColor="#7a5a1c" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="38%" r="55%">
          <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="1" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <pattern id={`${id}-tex`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 6L6 0" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="2" y="2" width="196" height="296" rx="12" fill={`url(#${id}-bg)`} />
      <rect x="2" y="2" width="196" height="296" rx="12" fill={`url(#${id}-tex)`} />
      <rect x="2" y="2" width="196" height="296" rx="12" fill={`url(#${id}-glow)`} />
      <rect
        x="8"
        y="8"
        width="184"
        height="284"
        rx="9"
        fill="none"
        stroke={`url(#${id}-gold)`}
        strokeWidth="3"
      />
      <rect
        x="16"
        y="16"
        width="168"
        height="268"
        rx="6"
        fill="none"
        stroke={`url(#${id}-gold)`}
        strokeWidth="1"
        opacity="0.7"
      />
      {/* 四隅の飾り */}
      {[
        [22, 22],
        [178, 22],
        [22, 278],
        [178, 278],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="4" fill={`url(#${id}-gold)`} />
          <path d="M-7 0h14M0 -7v14" stroke={`url(#${id}-gold)`} strokeWidth="1" />
        </g>
      ))}
      {children}
    </svg>
  )
}

function Label({ id, ja, en }: { id: string; ja: string; en: string }) {
  return (
    <>
      <rect x="40" y="236" width="120" height="38" rx="4" fill="rgba(0,0,0,0.55)" stroke={`url(#${id}-gold)`} strokeWidth="1" />
      <text
        x="100"
        y="256"
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fill="#f3dc9a"
        style={{ fontFamily: 'var(--font-serif-jp)' }}
      >
        {ja}
      </text>
      <text x="100" y="269" textAnchor="middle" fontSize="8" letterSpacing="3" fill="#c9a24a">
        {en}
      </text>
    </>
  )
}

/* ---------- 王様 ---------- */
export function KingArt() {
  const id = 'king'
  return (
    <Frame id={id} from="#3a0a12" to="#120408">
      {/* 玉座の背 */}
      <path d="M58 220V110l12-16 10 16 10-20 10 20 10-16 10 16 10-20 10 20 12 16v110z" fill="#2a0810" stroke="#7a1c2a" strokeWidth="1.5" />
      {/* 後光 */}
      <circle cx="100" cy="92" r="46" fill="none" stroke="#c9a24a" strokeWidth="1" opacity="0.5" />
      <circle cx="100" cy="92" r="40" fill="none" stroke="#c9a24a" strokeWidth="0.6" opacity="0.4" />
      {/* 王冠 */}
      <path d="M72 78l8-26 12 16 8-28 8 28 12-16 8 26z" fill={`url(#${id}-gold)`} stroke="#5a3a0a" strokeWidth="1" />
      <rect x="70" y="76" width="60" height="10" rx="2" fill={`url(#${id}-gold)`} stroke="#5a3a0a" strokeWidth="1" />
      <circle cx="80" cy="81" r="2.6" fill="#9b1c2e" />
      <circle cx="100" cy="81" r="3" fill="#1e5f8a" />
      <circle cx="120" cy="81" r="2.6" fill="#9b1c2e" />
      {/* 顔 */}
      <ellipse cx="100" cy="106" rx="18" ry="20" fill="#d9b48c" />
      <path d="M86 100q14 -6 28 0" stroke="#5a3a28" strokeWidth="1" fill="none" />
      <path d="M92 104h5M103 104h5" stroke="#1a0a08" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M84 118q16 26 32 0 -4 20 -16 24 -12 -4 -16 -24z" fill="#efe6d6" opacity="0.95" />
      {/* 肩・マント */}
      <path d="M48 230q10-82 52-96 42 14 52 96z" fill="#8a1424" stroke="#3a0a12" strokeWidth="2" />
      <path d="M62 230q6-60 38-80 32 20 38 80z" fill="#b01a2e" opacity="0.8" />
      {/* 毛皮 */}
      <path d="M62 230q10-68 38-84 28 16 38 84" fill="none" stroke="#efe6d6" strokeWidth="7" strokeLinecap="round" strokeDasharray="4 5" opacity="0.9" />
      {/* 王笏 */}
      <line x1="146" y1="140" x2="140" y2="226" stroke={`url(#${id}-gold)`} strokeWidth="4" strokeLinecap="round" />
      <circle cx="147" cy="134" r="8" fill="#9b1c2e" stroke={`url(#${id}-gold)`} strokeWidth="2.5" />
      <path d="M147 118v8M139 126h16" stroke={`url(#${id}-gold)`} strokeWidth="2.5" />
      {/* ローマ数字 */}
      <text x="100" y="40" textAnchor="middle" fontSize="12" fill="#c9a24a" letterSpacing="2" style={{ fontFamily: 'var(--font-serif-jp)' }}>
        IV
      </text>
      <Label id={id} ja="王様" en="THE KING" />
    </Frame>
  )
}

/* ---------- 市民 ---------- */
export function CitizenArt() {
  const id = 'citizen'
  return (
    <Frame id={id} from="#1a2230" to="#07090e">
      {/* 月 */}
      <circle cx="140" cy="62" r="18" fill="#d8dde6" opacity="0.85" />
      <circle cx="146" cy="56" r="16" fill="#1a2230" />
      {/* 街 */}
      <path d="M22 200h20v-30h12v-12h10v42h16v-52h10l6-14 6 14h10v52h14v-36h12v-10h10v46h14v-22h16v22" fill="#0c1018" stroke="#3a4656" strokeWidth="1" />
      {/* 窓 */}
      {[
        [46, 180], [86, 165], [130, 178], [160, 186], [100, 190],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="4" height="6" fill="#e3b05a" opacity="0.75" />
      ))}
      {/* フード姿 */}
      <path d="M60 232q4-70 40-96 36 26 40 96z" fill="#3a4a62" stroke="#111823" strokeWidth="2" />
      <path d="M72 232q6-54 28-74 22 20 28 74z" fill="#546a86" opacity="0.6" />
      <path d="M78 136q22-30 44 0 -2 24 -22 30 -20 -6 -22 -30z" fill="#1b2330" />
      <ellipse cx="100" cy="146" rx="13" ry="16" fill="#c9a98a" />
      <path d="M92 144h5M103 144h5" stroke="#1a0a08" strokeWidth="2" strokeLinecap="round" />
      <path d="M94 156q6 3 12 0" stroke="#5a3a28" strokeWidth="1.2" fill="none" />
      {/* 手に松明 */}
      <line x1="136" y1="170" x2="136" y2="222" stroke="#6b4a2a" strokeWidth="4" strokeLinecap="round" />
      <path d="M136 150q-10 12 0 22 10-10 0-22z" fill="#ffb347" />
      <path d="M136 156q-5 7 0 13 5-6 0-13z" fill="#fff3c2" />
      <text x="100" y="40" textAnchor="middle" fontSize="12" fill="#c9a24a" letterSpacing="2" style={{ fontFamily: 'var(--font-serif-jp)' }}>
        X
      </text>
      <Label id={id} ja="市民" en="THE CITIZEN" />
    </Frame>
  )
}

/* ---------- 奴隷 ---------- */
export function SlaveArt() {
  const id = 'slave'
  return (
    <Frame id={id} from="#0e1a12" to="#050806">
      {/* 鉄格子の影 */}
      {[40, 70, 100, 130, 160].map((x) => (
        <rect key={x} x={x - 2} y="26" width="4" height="200" fill="#0a0d0a" opacity="0.8" />
      ))}
      <rect x="22" y="60" width="156" height="4" fill="#0a0d0a" opacity="0.8" />
      {/* 血の飛沫 */}
      <circle cx="56" cy="200" r="6" fill="#6a0f1a" opacity="0.7" />
      <circle cx="66" cy="212" r="3" fill="#6a0f1a" opacity="0.7" />
      <circle cx="150" cy="208" r="4" fill="#6a0f1a" opacity="0.7" />
      {/* 身体（うつむく） */}
      <path d="M62 232q0-60 38-76 38 16 38 76z" fill="#2c3b2a" stroke="#0e1a12" strokeWidth="2" />
      <path d="M74 232q0-48 26-60 26 12 26 60z" fill="#4a5a3a" opacity="0.5" />
      {/* 肋の浮いた胸 */}
      <path d="M86 196q14 6 28 0M86 206q14 6 28 0" stroke="#0e1a12" strokeWidth="1.5" fill="none" opacity="0.8" />
      {/* 頭 */}
      <ellipse cx="100" cy="142" rx="17" ry="19" fill="#b8926e" />
      <path d="M84 132q16-14 32 0" fill="#1a1410" />
      <path d="M91 142l6 3M109 142l-6 3" stroke="#1a0a08" strokeWidth="2" strokeLinecap="round" />
      <path d="M94 154q6 -3 12 0" stroke="#5a3a28" strokeWidth="1.3" fill="none" />
      {/* 首枷と鎖 */}
      <rect x="82" y="158" width="36" height="10" rx="3" fill="#4a4a4a" stroke="#1a1a1a" strokeWidth="1.5" />
      {[
        [66, 176], [58, 190], [52, 206], [48, 222],
      ].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="5" ry="7" fill="none" stroke="#7a7a7a" strokeWidth="2.5" transform={`rotate(-25 ${x} ${y})`} />
      ))}
      <path d="M82 163q-14 6 -16 13" stroke="#7a7a7a" strokeWidth="2.5" fill="none" />
      {/* 手首の枷 */}
      <rect x="126" y="200" width="20" height="9" rx="3" fill="#4a4a4a" stroke="#1a1a1a" strokeWidth="1.5" />
      <text x="100" y="40" textAnchor="middle" fontSize="12" fill="#c9a24a" letterSpacing="2" style={{ fontFamily: 'var(--font-serif-jp)' }}>
        0
      </text>
      <Label id={id} ja="奴隷" en="THE SLAVE" />
    </Frame>
  )
}

/* ---------- 裏面：禍々しい魔方陣 ---------- */
export function CardBackArt() {
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'
  return (
    <svg viewBox="0 0 200 300" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="back-bg" cx="50%" cy="50%" r="70%">
          <stop offset="0" stopColor="#2b0a12" />
          <stop offset="0.6" stopColor="#130509" />
          <stop offset="1" stopColor="#060203" />
        </radialGradient>
        <linearGradient id="back-blood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4a5c" />
          <stop offset="0.5" stopColor="#9b1c2e" />
          <stop offset="1" stopColor="#4a0a12" />
        </linearGradient>
        <linearGradient id="back-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e3a3" />
          <stop offset="0.5" stopColor="#c9a24a" />
          <stop offset="1" stopColor="#7a5a1c" />
        </linearGradient>
        <filter id="back-glow">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="2" y="2" width="196" height="296" rx="12" fill="url(#back-bg)" />
      <rect x="8" y="8" width="184" height="284" rx="9" fill="none" stroke="url(#back-gold)" strokeWidth="3" />
      <rect x="15" y="15" width="170" height="270" rx="6" fill="none" stroke="#9b1c2e" strokeWidth="1" opacity="0.8" />
      {/* 外周ルーン */}
      <g filter="url(#back-glow)">
        <circle cx="100" cy="150" r="78" fill="none" stroke="url(#back-blood)" strokeWidth="2" />
        <circle cx="100" cy="150" r="68" fill="none" stroke="url(#back-blood)" strokeWidth="1" />
        {runes.split('').map((r, i) => {
          const a = (i / runes.length) * Math.PI * 2 - Math.PI / 2
          const x = 100 + Math.cos(a) * 73
          const y = 150 + Math.sin(a) * 73
          return (
            <text key={i} x={x} y={y} fontSize="7" fill="#e3b05a" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`}>
              {r}
            </text>
          )
        })}
        {/* 五芒星（逆） */}
        <polygon
          points={[0, 1, 2, 3, 4]
            .map((i) => {
              const a = (i * 144 * Math.PI) / 180 + Math.PI / 2
              return `${100 + Math.cos(a) * 62},${150 + Math.sin(a) * 62}`
            })
            .join(' ')}
          fill="none"
          stroke="url(#back-blood)"
          strokeWidth="2.2"
        />
        <circle cx="100" cy="150" r="24" fill="none" stroke="url(#back-gold)" strokeWidth="1.2" />
        {/* 中心の眼 */}
        <path d="M76 150q24-20 48 0 -24 20 -48 0z" fill="#0b0306" stroke="url(#back-gold)" strokeWidth="1.5" />
        <circle cx="100" cy="150" r="7" fill="url(#back-blood)" />
        <circle cx="100" cy="150" r="2.5" fill="#000" />
        <circle cx="102" cy="147" r="1.2" fill="#fff" opacity="0.8" />
      </g>
      {/* 小さな呪印 */}
      {[
        [34, 40], [166, 40], [34, 260], [166, 260],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`} opacity="0.85">
          <circle r="9" fill="none" stroke="#9b1c2e" strokeWidth="1" />
          <path d="M0 -9V9M-9 0H9M-6 -6L6 6M6 -6L-6 6" stroke="#c9a24a" strokeWidth="0.8" />
        </g>
      ))}
      <text x="100" y="33" textAnchor="middle" fontSize="9" letterSpacing="4" fill="#c9a24a" style={{ fontFamily: 'var(--font-serif-jp)' }}>
        E - C A R D
      </text>
      <text x="100" y="277" textAnchor="middle" fontSize="7" letterSpacing="3" fill="#9b1c2e">
        ABANDON ALL HOPE
      </text>
    </svg>
  )
}

const IMAGE_NAME: Record<CardType, string> = {
  king: 'king.png',
  citizen: 'citizen.png',
  slave: 'slave.png',
}

/** カードの表面。public/ に画像があればそれを優先、無ければ SVG を描く */
export function CardFace({ type }: { type: CardType }) {
  const img = useOptionalImage(IMAGE_NAME[type])
  if (img) {
    return <img src={img} alt="" className="h-full w-full rounded-[6%] object-cover" draggable={false} />
  }
  if (type === 'king') return <KingArt />
  if (type === 'slave') return <SlaveArt />
  return <CitizenArt />
}

export function CardBack() {
  const img = useOptionalImage('card_back.png')
  if (img) {
    return <img src={img} alt="" className="h-full w-full rounded-[6%] object-cover" draggable={false} />
  }
  return <CardBackArt />
}
