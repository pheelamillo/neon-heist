export type Phase = "lobby" | "planning" | "reveal" | "finished";
export type RoomMode = "multiplayer" | "practice";
export type Specialty = "tech" | "force" | "stealth" | "social" | "transit";
export type OperativeId = "ghost" | "brute" | "wraith" | "switch" | "rook" | "oracle";

export interface Operative {
  id: OperativeId;
  name: string;
  role: string;
  power: number;
  specialty: Specialty | "wild";
  bonus: number;
  color: string;
  symbol: string;
}

export interface Target {
  id: number;
  name: string;
  district: string;
  specialty: Specialty;
  difficulty: number;
  loot: number;
}

export interface Player {
  id: string;
  userId: string;
  nickname: string;
  score: number;
  ready: boolean;
  doubleCrossUsed: boolean;
  availableFrom: Partial<Record<OperativeId, number>>;
  isComputer?: boolean;
  computerCrossRound?: number;
}

export interface Submission {
  playerId: string;
  operative: OperativeId;
  target: number;
  doubleCross: boolean;
  submittedAt: number;
}

export interface PlayerResult {
  playerId: string;
  operative: OperativeId | null;
  target: number | null;
  doubleCross: boolean;
  power: number;
  earned: number;
  outcome: "paid" | "betrayed" | "alarm" | "failed" | "passed";
}

export interface TargetResult {
  target: Target;
  power: number;
  success: boolean;
  alarm: boolean;
  playerIds: string[];
  betrayer: string | null;
}

export interface RoundResult {
  round: number;
  targets: TargetResult[];
  players: PlayerResult[];
}

// Only the server reads/writes this complete document in heist_private.rooms.
export interface Room {
  // Missing fields identify rooms created before the simpler vault rules.
  rulesVersion?: 1 | 2;
  mode?: RoomMode;
  id: string;
  code: string;
  matchId: string;
  hostId: string;
  phase: Phase;
  round: number;
  roundSeconds: number;
  deadline: number | null;
  players: Player[];
  submissions: Submission[];
  history: RoundResult[];
  createdAt: number;
  version: number;
}

export interface PublicPlayer {
  isComputer: boolean;
  id: string;
  nickname: string;
  score: number | null;
  ready: boolean;
  submitted: boolean;
  doubleCrossAvailable: boolean;
  availableFrom: Partial<Record<OperativeId, number>>;
}

export interface PublicRoundResult extends Omit<RoundResult, "players"> {
  players: (Omit<PlayerResult, "earned"> & { earned: number | null })[];
}

export interface RoomView {
  rulesVersion: 1 | 2;
  mode: RoomMode;
  id: string;
  code: string;
  matchId: string;
  hostId: string;
  phase: Phase;
  round: number;
  roundSeconds: number;
  deadline: number | null;
  players: PublicPlayer[];
  targets: Target[];
  history: PublicRoundResult[];
  version: number;
  serverNow: number;
  me: string;
  mySubmission: Submission | null;
}

export type Command =
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "submit"; operative?: OperativeId; target: number; doubleCross: boolean }
  | { type: "rematch" }
  | { type: "leave" };

export type CommandRequest = Command & { matchId: string; expectedRound: number };
