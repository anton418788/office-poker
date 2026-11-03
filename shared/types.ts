import type { CaseOpening } from "./cases";
import type { Appearance, Inventory } from "./cosmetics";
export type Card = { rank: number; suit: "s" | "h" | "d" | "c" };
export type Player = {
  id: string;
  name: string;
  seat: number;
  bot?: boolean;
  appearance?: Appearance;
  chips: number;
  cards: Card[];
  folded: boolean;
  lastAction?: {
    kind: "fold" | "check" | "call" | "raise";
    amount?: number;
    hand: number;
  };
  bet: number;
  total: number;
};
export type ChipTransfer = {
  id: number;
  hand: number;
  seat: number;
  amount: number;
  kind: "bet" | "payout";
};
export type DealPresentation = {
  holeMode?: "rounds" | "pairs";
  timing?: { interval: number; flight: number; flip: number; lead: number };
  id: number;
  hand: number;
  dealer: number;
  seats: number[];
  hole: boolean;
  boardFrom: number;
  boardTo: number;
  startedAt: number;
  endsAt: number;
  pausedAt?: number;
};
export type CheckEvent = { id: number; hand: number; seat: number };
export type HandWinner = {
  id: string;
  name: string;
  seat: number;
  amount: number;
  combination: string | null;
  cards: Card[];
  boardIndexes: number[];
  holeIndexes: number[];
};
export type HandResult = {
  hand: number;
  byFold: boolean;
  winners: HandWinner[];
  previousWinnerIds: string[];
};
export type Game = {
  cardBack?: string;
  lastResult?: HandResult;
  checkSeq?: number;
  checks?: CheckEvent[];
  deal?: DealPresentation;
  dealAnimations?: boolean;
  transferSeq?: number;
  transfers?: ChipTransfer[];
  players: Player[];
  deck: Card[];
  board: Card[];
  phase: "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";
  dealer: number;
  actor: string | null;
  currentBet: number;
  minRaise: number;
  acted: string[];
  deadline: number | null;
  paused: boolean;
  remaining: number;
  hand: number;
  settings: {
    small: number;
    big: number;
    stack: number;
    minutes: number;
    step?: number;
  };
  log: string[];
  result: string[];
};
export type View = Omit<Game, "deck"> & {
  room?: { id: string; name: string; hostId: string; hostName: string };
  canManage?: boolean;
  me: string;
  admin: boolean;
  legal: { call: number; min: number; max: number; canRaise: boolean };
};

export type Account = {
  id: string;
  login: string | null;
  name: string;
  balance: number;
  admin: boolean;
};
export type RoomSummary = {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  humans: number;
  bots: number;
  online: number;
  phase: Game["phase"];
  small: number;
  big: number;
  minutes: number;
  emptySince: number | null;
  seated: boolean;
};
export type ClubState = {
  account: Account | null;
  needsSetup: boolean;
  canSetup: boolean;
  rooms: RoomSummary[];
  room?: View;
  activeRoom?: View;
  inventory?: Inventory;
  caseOpening?: CaseOpening;
};
