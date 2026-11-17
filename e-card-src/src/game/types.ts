export type CardType = 'king' | 'citizen' | 'slave'
export type Side = 'king' | 'slave'
export type Owner = 'player' | 'cpu'
export type Outcome = 'win' | 'lose' | 'draw'

/** ゲーム進行フェーズ */
export type Phase =
  | 'start'
  | 'setIntro'
  | 'cpuThinking'
  | 'playerSelect'
  | 'reveal'
  | 'turnResult'
  | 'setResult'
  | 'matchOver'

/** CPU のプレイスタイル。スコア状況で変わる */
export type CpuStyle = 'normal' | 'aggressive' | 'cautious'

/** CPU の表情シグナル（本音のこともブラフのこともある） */
export type TellMood = 'sweat' | 'tremble' | 'smirk' | 'relaxed' | 'poker' | 'silent'

/** オープン時の衝撃演出。clash = 王様 vs 奴隷の激突 */
export type Impact = 'none' | 'hit' | 'clash'

/** 1 セットの結果（プレイヤー視点）と獲得ポイント */
export interface SetRecord {
  outcome: Outcome
  /** 勝者が得たポイント。引き分けは 0。奴隷ボーナス時に奴隷側で勝つと 2 */
  points: number
  playerSide: Side
}

/** ターン開始時に CPU が決めている手と、そのとき見せる表情 */
export interface CpuPlan {
  idx: number
  tell: TellMood
}

export const WIN_TARGET = 5
export const MAX_TURNS = 5

export interface GameState {
  phase: Phase
  playerSide: Side
  setNo: number
  turn: number
  playerHand: CardType[]
  /** playerHand と同じ並びの安定 ID。カードを出したときに正しい 1 枚がアニメーションで抜けるようにする */
  playerHandIds: number[]
  cpuHand: CardType[]
  playerPlayed: CardType | null
  cpuPlayed: CardType | null
  revealed: boolean
  impact: Impact
  /** 現在のターンの結果（プレイヤー視点） */
  turnOutcome: Outcome | null
  history: SetRecord[]
  selectedIdx: number | null
  /** 奴隷側で勝つと 2 ポイントになるモード */
  bonusMode: boolean
  cpuStyle: CpuStyle
  cpuPlan: CpuPlan | null
}
