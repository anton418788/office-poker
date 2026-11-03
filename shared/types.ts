export type Card = { rank: number; suit: "s" | "h" | "d" | "c" };
export type Player = {
  id: string;
  name: string;
  seat: number;
  bot?: boolean;
  chips: number;
  cards: Card[];
  folded: boolean;
  bet: number;
  total: number;
};
export type Game = {
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
  settings: { small: number; big: number; stack: number; minutes: number };
  log: string[];
  result: string[];
};
export type View = Omit<Game, "deck"> & {
  me: string;
  admin: boolean;
  legal: { call: number; min: number; max: number; canRaise: boolean };
};
