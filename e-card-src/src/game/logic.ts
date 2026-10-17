import type { CardType, Outcome, Side } from './types'

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

/**
 * CPU の思考。ランダムをベースに、ターンが進むほど特殊カードを切る確率が上がる。
 * 5 ターン目は手札が 1 枚しか残らないので実質確定。
 */
export function cpuChoose(hand: CardType[], turn: number, rng: () => number = Math.random): number {
  if (hand.length <= 1) return 0
  const specialIdx = hand.findIndex((c) => c !== 'citizen')
  if (specialIdx === -1) return Math.floor(rng() * hand.length)

  // 人間らしい揺らぎ: turn*0.2 を中心に ±0.12 ぶらす
  const base = turn * 0.2
  const jitter = (rng() - 0.5) * 0.24
  const p = turn >= 5 ? 1 : Math.min(0.95, Math.max(0.05, base + jitter))

  if (rng() < p) return specialIdx
  const citizens = hand.map((c, i) => (c === 'citizen' ? i : -1)).filter((i) => i >= 0)
  return citizens[Math.floor(rng() * citizens.length)]
}

/** 1.0 〜 2.0 秒の思考ディレイ（ms） */
export function cpuThinkDelay(rng: () => number = Math.random): number {
  return 1000 + Math.floor(rng() * 1000)
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
