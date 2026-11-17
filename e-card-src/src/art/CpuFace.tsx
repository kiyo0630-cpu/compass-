import type { TellMood } from '../game/types'

/** 表情シグナルに加えて、思考中と決着後のリアクションも描く */
export type FaceMood = TellMood | 'thinking' | 'shock' | 'triumph'

interface Props {
  mood: FaceMood
  className?: string
}

/**
 * CPU（冷徹な胴元）の顔。表情ごとに眉・目・口・汗が変わる。
 * 動揺系（sweat / tremble / shock）は汗や震えを伴い、余裕系（smirk / relaxed / triumph）は口角が上がる。
 */
export function CpuFace({ mood, className = '' }: Props) {
  const nervous = mood === 'sweat' || mood === 'tremble' || mood === 'shock'
  const smug = mood === 'smirk' || mood === 'triumph'
  const eyesClosed = mood === 'silent' || mood === 'relaxed'
  const wideEyes = mood === 'shock' || mood === 'tremble'

  // 眉: 動揺は内側が上がり、不敵な笑みは片眉が上がる
  const browL = nervous ? 'M29 31 L37 27.5' : smug ? 'M29 27 L37 29.5' : 'M29 28.5 L37 30'
  const browR = nervous ? 'M43 27.5 L51 31' : smug ? 'M43 30 L51 26' : 'M43 30 L51 28.5'

  const mouth = (() => {
    switch (mood) {
      case 'smirk':
        return 'M34 46.5 Q40 48.5 47 43'
      case 'triumph':
        return 'M33 44 Q40 51 47 44'
      case 'relaxed':
        return 'M35 45.5 Q40 48 45 45.5'
      case 'sweat':
        return 'M35 47 Q37.5 45.5 40 47 Q42.5 48.5 45 47'
      case 'tremble':
        return 'M34.5 46 H45.5 M34.5 48 H45.5 M38 46 V48 M42 46 V48'
      case 'shock':
        return 'M36 45 Q40 43 44 45 Q44 50 40 50 Q36 50 36 45'
      default:
        return 'M35.5 46.5 H44.5'
    }
  })()

  return (
    <div className={`relative ${className} ${mood === 'tremble' ? 'cpu-tremble' : ''}`} aria-hidden>
      <svg viewBox="0 0 80 80" className="h-full w-full">
        <defs>
          <radialGradient id="cpu-bg" cx="50%" cy="35%" r="70%">
            <stop offset="0" stopColor="#3a1018" />
            <stop offset="1" stopColor="#0a0406" />
          </radialGradient>
          <linearGradient id="cpu-skin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c9b29a" />
            <stop offset="1" stopColor="#7d6a58" />
          </linearGradient>
          <clipPath id="cpu-clip">
            <circle cx="40" cy="40" r="37" />
          </clipPath>
        </defs>
        <circle cx="40" cy="40" r="38" fill="url(#cpu-bg)" stroke="#8a6a24" strokeWidth="1.5" />
        <g clipPath="url(#cpu-clip)">
          {/* スーツ・襟・ネクタイ */}
          <path d="M6 82 Q10 60 30 57 L40 66 L50 57 Q70 60 74 82 Z" fill="#121218" />
          <path d="M32.5 57.5 L40 67 L47.5 57.5 L44 55 L40 60 L36 55 Z" fill="#d6d6d6" />
          <path d="M40 60.5 L37.6 66 L40 78 L42.4 66 Z" fill="#7a0f1c" />
          {/* 首・顔 */}
          <rect x="35" y="48" width="10" height="10" fill="#6b5a4a" />
          <path d="M26 30 Q26 14 40 14 Q54 14 54 30 L53 40 Q51 52 40 54.5 Q29 52 27 40 Z" fill="url(#cpu-skin)" />
          {/* オールバックの銀髪 */}
          <path d="M24.5 31 Q22 9 40 8 Q58 9 55.5 31 Q54 20 46 16.5 Q40 14.5 34 16.5 Q26 20 24.5 31 Z" fill="#a4a4a8" />
          <path d="M31 13 Q40 10 49 13" stroke="#d0d0d4" strokeWidth="0.8" fill="none" opacity="0.7" />
          {/* 目元の影 */}
          <path d="M27 27 H53 V37 Q40 39 27 37 Z" fill="rgba(0,0,0,0.38)" />
          {/* 眉 */}
          <path d={browL} stroke="#2a2a2e" strokeWidth="2" strokeLinecap="round" />
          <path d={browR} stroke="#2a2a2e" strokeWidth="2" strokeLinecap="round" />
          {/* 目 */}
          {eyesClosed ? (
            <>
              <path d="M30 34 Q33.5 35.5 37 34" stroke="#101014" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              <path d="M43 34 Q46.5 35.5 50 34" stroke="#101014" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            </>
          ) : wideEyes ? (
            <>
              <ellipse cx="33.5" cy="34" rx="3.4" ry="2.6" fill="#f2efe8" />
              <ellipse cx="46.5" cy="34" rx="3.4" ry="2.6" fill="#f2efe8" />
              <circle cx="33.5" cy="34" r="1.1" fill="#101014" />
              <circle cx="46.5" cy="34" r="1.1" fill="#101014" />
            </>
          ) : (
            <>
              <path d="M30 34 Q33.5 32 37 34 Q33.5 35.6 30 34 Z" fill="#f2efe8" />
              <path d="M43 34 Q46.5 32 50 34 Q46.5 35.6 43 34 Z" fill="#f2efe8" />
              <circle cx={smug ? 34.4 : 33.5} cy="34" r="1.15" fill="#101014" />
              <circle cx={smug ? 47.4 : 46.5} cy="34" r="1.15" fill="#101014" />
            </>
          )}
          {/* 鼻・ほうれい線 */}
          <path d="M40 35 L38.6 42 H41.2" stroke="#5a4a3c" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M33 42 Q32 45 33.5 48 M47 42 Q48 45 46.5 48" stroke="#5a4a3c" strokeWidth="0.7" fill="none" opacity="0.7" />
          {/* 口 */}
          <path d={mouth} stroke="#2a1414" strokeWidth="1.5" fill={mood === 'shock' ? '#2a0a0e' : 'none'} strokeLinecap="round" strokeLinejoin="round" />
          {mood === 'triumph' && <path d="M35 45.5 Q40 49 45 45.5" stroke="#f2efe8" strokeWidth="1" fill="none" />}
          {/* 汗 */}
          {(mood === 'sweat' || mood === 'shock') && (
            <>
              <path className="cpu-sweat" d="M56 26 q-2.2 4 0 5.6 q2.2 -1.6 0 -5.6 z" fill="#bfe3ff" />
              <path className="cpu-sweat cpu-sweat-2" d="M23.5 33 q-1.8 3.4 0 4.8 q1.8 -1.4 0 -4.8 z" fill="#bfe3ff" />
            </>
          )}
          {mood === 'tremble' && (
            <path d="M58 40 q3 2 0 4 q-3 2 0 4 M21 40 q-3 2 0 4 q3 2 0 4" stroke="#e8d9c0" strokeWidth="1" fill="none" opacity="0.8" />
          )}
          {mood === 'thinking' && (
            <g fill="#e8d9c0" opacity="0.85">
              <circle className="cpu-dot" cx="57" cy="20" r="1.6" />
              <circle className="cpu-dot cpu-dot-2" cx="62" cy="20" r="1.6" />
              <circle className="cpu-dot cpu-dot-3" cx="67" cy="20" r="1.6" />
            </g>
          )}
        </g>
      </svg>
    </div>
  )
}
