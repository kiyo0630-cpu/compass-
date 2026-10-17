import { useEffect, useRef } from 'react'
import type { Outcome } from '../game/types'
import { WIN_TARGET } from '../game/types'
import { AngelIcon, DemonIcon } from '../art/Icons'

interface Props {
  history: Outcome[]
  currentSet: number
  matchOver: boolean
}

function Cell({ outcome, forCpu }: { outcome: Outcome; forCpu: boolean }) {
  const won = forCpu ? outcome === 'lose' : outcome === 'win'
  const lost = forCpu ? outcome === 'win' : outcome === 'lose'
  if (won)
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gold/70 bg-gold/10">
        <AngelIcon className="h-6 w-6" />
      </div>
    )
  if (lost)
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-blood/70 bg-blood/10">
        <DemonIcon className="h-6 w-6" />
      </div>
    )
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-sm text-white/50">
      -
    </div>
  )
}

function Pending() {
  return (
    <div className="pulse-dash h-7 w-7 rounded-full border-2 border-dashed border-gold/80" />
  )
}

/** サッカー PK 風スコアボード：YOU / CPU の 2 行で全セット履歴を横並び表示 */
export function ScoreBoard({ history, currentSet, matchOver }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const playerWins = history.filter((h) => h === 'win').length
  const cpuWins = history.filter((h) => h === 'lose').length
  const cols = Math.max(WIN_TARGET, history.length + (matchOver ? 0 : 1))

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }, [history.length])

  return (
    <div className="rounded-lg border border-gold/30 bg-black/50 px-2 py-1.5 backdrop-blur-sm">
      <div className="flex items-stretch gap-2">
        {/* ラベル＆合計 */}
        <div className="flex shrink-0 flex-col justify-around text-[11px] font-bold tracking-wider">
          <div className="flex items-center gap-1.5">
            <span className="gold-text w-8">YOU</span>
            <span className="w-4 text-center text-base leading-none text-gold-light">{playerWins}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="blood-text w-8">CPU</span>
            <span className="w-4 text-center text-base leading-none text-red-300">{cpuWins}</span>
          </div>
        </div>
        <div className="w-px bg-gold/30" />
        {/* セット履歴 */}
        <div ref={scrollRef} className="no-scrollbar flex-1 overflow-x-auto">
          <div className="flex flex-col gap-1">
            {(['you', 'cpu'] as const).map((row) => (
              <div key={row} className="flex items-center gap-1.5">
                {Array.from({ length: cols }).map((_, i) => {
                  const h = history[i]
                  if (h) return <Cell key={i} outcome={h} forCpu={row === 'cpu'} />
                  if (i === currentSet - 1 && !matchOver) return <Pending key={i} />
                  return <div key={i} className="h-7 w-7 rounded-full border border-white/10" />
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
