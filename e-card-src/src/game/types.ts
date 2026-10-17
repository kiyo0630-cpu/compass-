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

export const WIN_TARGET = 5
export const MAX_TURNS = 5

export interface GameState {
  phase: Phase
  playerSide: Side
  setNo: number
  turn: number
  playerHand: CardType[]
  cpuHand: CardType[]
  playerPlayed: CardType | null
  cpuPlayed: CardType | null
  revealed: boolean
  /** 現在のターンの結果（プレイヤー視点） */
  turnOutcome: Outcome | null
  /** 各セットの結果（プレイヤー視点） */
  history: Outcome[]
  selectedIdx: number | null
}
