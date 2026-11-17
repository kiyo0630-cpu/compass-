import type { CardType, CpuStyle, Outcome, SetRecord, Side, TellMood } from './types'
import { WIN_TARGET } from './types'

/** 陣営ごとの初期手札。特殊カードは親指の届きやすい中央に置く */
export function initialHand(side: Side): CardType[] {
  const special: CardType = side === 'king' ? 'king' : 'slave'
  return ['citizen', 'citizen', special, 'citizen', 'citizen']
}

export function otherSide(side: Side): Side {
  return side === 'king' ? 'slave' : 'king'
}

/**
 * 三すくみの勝敗判定。王様側のカードと奴隷側のカードを受け取り、勝った陣営を返す。
 * - 市民 対 市民: 引き分け
 * - 王様 対 市民: 王様側
 * - 市民 対 奴隷: 市民側（＝王様側）
 * - 王様 対 奴隷: 奴隷側
 */
export function judge(kingSideCard: CardType, slaveSideCard: CardType): Side | 'draw' {
  if (kingSideCard === 'citizen' && slaveSideCard === 'citizen') return 'draw'
  if (kingSideCard === 'king') return slaveSideCard === 'slave' ? 'slave' : 'king'
  // kingSideCard === 'citizen'
  return slaveSideCard === 'slave' ? 'king' : 'draw'
}

export function outcomeFor(
  playerSide: Side,
  playerCard: CardType,
  cpuCard: CardType,
): Outcome {
  const winner =
    playerSide === 'king' ? judge(playerCard, cpuCard) : judge(cpuCard, playerCard)
  if (winner === 'draw') return 'draw'
  return winner === playerSide ? 'win' : 'lose'
}

/** 王様と奴隷が同時に出た「激突」かどうか */
export function isClash(a: CardType, b: CardType): boolean {
  return (a === 'king' && b === 'slave') || (a === 'slave' && b === 'king')
}

/* ---------- 得点（奴隷ボーナス） ---------- */

/** その陣営でセットを取ったときのポイント。奴隷ボーナス時は奴隷側の勝利が 2 */
export function winPoints(winnerSide: Side, bonusMode: boolean): number {
  return bonusMode && winnerSide === 'slave' ? 2 : 1
}

export function pointsFor(outcome: Outcome, playerSide: Side, bonusMode: boolean): number {
  if (outcome === 'draw') return 0
  const winnerSide = outcome === 'win' ? playerSide : otherSide(playerSide)
  return winPoints(winnerSide, bonusMode)
}

export function score(history: SetRecord[]): { player: number; cpu: number } {
  let player = 0
  let cpu = 0
  for (const h of history) {
    if (h.outcome === 'win') player += h.points
    else if (h.outcome === 'lose') cpu += h.points
  }
  return { player, cpu }
}

/* ---------- CPU の性格 ---------- */

/**
 * スコア状況から次のセットの CPU のプレイスタイルを決める。
 * - このセットを取れば CPU の勝ち（リーチ）: 慎重型。終盤までじっくり待つ
 * - CPU が負け越している: 速攻型。焦って序盤から特殊カードをぶつける
 * - それ以外: 標準
 */
export function cpuStyleFor(
  cpuPoints: number,
  playerPoints: number,
  cpuWinPoints = 1,
  target = WIN_TARGET,
): CpuStyle {
  if (cpuPoints + cpuWinPoints >= target) return 'cautious'
  if (cpuPoints < playerPoints) return 'aggressive'
  return 'normal'
}

/** 各ターン（1〜4）で特殊カードを切る確率。5 ターン目は残り 1 枚なので確定 */
export const SPECIAL_RATE: Record<CpuStyle, readonly number[]> = {
  normal: [0.2, 0.4, 0.6, 0.8],
  aggressive: [0.45, 0.6, 0.75, 0.9],
  cautious: [0.06, 0.15, 0.4, 0.75],
}

/**
 * CPU の思考。ランダムをベースに、ターンが進むほど特殊カードを切る確率が上がる。
 * 確率の中心はプレイスタイルで変わり、そこへ人間らしい揺らぎ（±0.1）を乗せる。
 */
export function cpuChoose(
  hand: CardType[],
  turn: number,
  style: CpuStyle = 'normal',
  rng: () => number = Math.random,
): number {
  if (hand.length <= 1) return 0
  const specialIdx = hand.findIndex((c) => c !== 'citizen')
  if (specialIdx === -1) return Math.floor(rng() * hand.length)

  const rates = SPECIAL_RATE[style]
  const base = turn >= 5 ? 1 : rates[Math.max(0, turn - 1)]
  const jitter = (rng() - 0.5) * 0.2
  const p = turn >= 5 ? 1 : Math.min(0.97, Math.max(0.03, base + jitter))

  if (rng() < p) return specialIdx
  const citizens = hand.map((c, i) => (c === 'citizen' ? i : -1)).filter((i) => i >= 0)
  return citizens[Math.floor(rng() * citizens.length)]
}

/** 1.0 〜 2.0 秒の思考ディレイ（ms） */
export function cpuThinkDelay(rng: () => number = Math.random): number {
  return 1000 + Math.floor(rng() * 1000)
}

/* ---------- CPU の表情シグナル ---------- */

const NERVOUS: readonly TellMood[] = ['sweat', 'tremble']
const CALM: readonly TellMood[] = ['smirk', 'relaxed']
const NEUTRAL: readonly TellMood[] = ['poker', 'silent']

/** 表情が本音を映す確率／何も読めない確率（残りがブラフ） */
export const TELL_HONEST = 0.55
export const TELL_NEUTRAL = 0.25

/**
 * CPU が見せる表情を決める。
 * 本音のとき: 勝負手（王様／奴隷）なら動揺、市民なら余裕。
 * ブラフのとき: その逆を演じる。残りは無表情で何も読ませない。
 */
export function makeTell(playsSpecial: boolean, rng: () => number = Math.random): TellMood {
  const pick = (list: readonly TellMood[]) => list[Math.floor(rng() * list.length)]
  const r = rng()
  if (r < TELL_NEUTRAL) return pick(NEUTRAL)
  const honest = r < TELL_NEUTRAL + TELL_HONEST
  const showNervous = honest ? playsSpecial : !playsSpecial
  return pick(showNervous ? NERVOUS : CALM)
}

export function tellKind(mood: TellMood): 'nervous' | 'calm' | 'neutral' {
  if (NERVOUS.includes(mood)) return 'nervous'
  if (CALM.includes(mood)) return 'calm'
  return 'neutral'
}

export const TELL_TEXT: Record<TellMood, string> = {
  sweat: '冷や汗が一筋…',
  tremble: '指先が震えている…',
  smirk: '不敵な笑み…',
  relaxed: '余裕の表情…',
  poker: '無表情……',
  silent: '沈黙……',
}

export function removeAt<T>(arr: T[], idx: number): T[] {
  return arr.filter((_, i) => i !== idx)
}

export const CARD_LABEL: Record<CardType, { ja: string; en: string }> = {
  king: { ja: '王様', en: 'KING' },
  citizen: { ja: '市民', en: 'CITIZEN' },
  slave: { ja: '奴隷', en: 'SLAVE' },
}

export const SIDE_LABEL: Record<Side, string> = {
  king: '王様側',
  slave: '奴隷側',
}
