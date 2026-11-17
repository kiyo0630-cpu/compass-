import type { Side } from '../game/types'
import { MAX_TURNS } from '../game/types'

const CITIZENS = MAX_TURNS - 1

function PipRow({ label, cls, discarded }: { label: string; cls: string; discarded: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`w-6 text-[8px] font-bold tracking-wider ${cls}`}>{label}</span>
      {Array.from({ length: CITIZENS }).map((_, i) => (
        <span
          key={i}
          className={`flex h-[15px] w-[11px] items-center justify-center rounded-[2px] text-[7px] font-bold leading-none ${
            i < discarded
              ? 'border border-slate-400/70 bg-slate-700 text-slate-200 shadow-[0_0_4px_rgba(0,0,0,0.6)]'
              : 'border border-dashed border-white/20 text-transparent'
          }`}
        >
          市
        </span>
      ))}
    </div>
  )
}

/** 捨て札（墓場）トラッカー：このセットで消費された市民を両者ぶん並べる */
export function Graveyard({ discarded }: { discarded: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-white/10 bg-black/35 px-1.5 py-1.5">
      <span className="text-[8px] tracking-[0.2em] text-white/55">捨て札 市民</span>
      <PipRow label="CPU" cls="text-red-300/80" discarded={discarded} />
      <PipRow label="YOU" cls="text-gold/80" discarded={discarded} />
    </div>
  )
}

/** 相手の残り手札に特殊カードが含まれる割合（単純計算）。ターンが進むほど跳ね上がる */
export function Odds({ cpuSide, remaining }: { cpuSide: Side; remaining: number }) {
  const n = Math.max(1, remaining)
  const pct = Math.round(100 / n)
  const tone =
    pct >= 100 ? 'text-red-400' : pct >= 50 ? 'text-red-300' : pct >= 33 ? 'text-orange-300' : 'text-gold-light'
  return (
    <div className="flex flex-col items-center rounded-md border border-white/10 bg-black/35 px-2 py-1.5">
      <span className="text-[8px] tracking-[0.15em] text-white/55">相手の{cpuSide === 'king' ? '王様' : '奴隷'}</span>
      <span className={`text-lg font-black leading-tight ${tone} ${pct >= 50 ? 'animate-pulse' : ''}`}>1/{n}</span>
      <span className={`text-[10px] font-bold leading-none ${tone}`}>{pct >= 100 ? '確定' : `${pct}%`}</span>
    </div>
  )
}
