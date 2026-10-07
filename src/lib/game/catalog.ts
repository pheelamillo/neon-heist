import type { Operative, OperativeId, Specialty, Target } from "./types";

export const TOTAL_ROUNDS = 4;
export const MAX_PLAYERS = 8;
export const REVEAL_SECONDS = 8;
export const ROUND_OPTIONS = [20, 45, 60] as const;

export const OPERATIVES: Operative[] = [
  { id: "ghost", name: "Ghost", role: "Hacker", power: 2, specialty: "tech", bonus: 3, color: "#adfd79", symbol: "⌘" },
  { id: "brute", name: "Brute", role: "Enforcer", power: 3, specialty: "force", bonus: 2, color: "#ff9466", symbol: "✦" },
  { id: "wraith", name: "Wraith", role: "Infiltrator", power: 2, specialty: "stealth", bonus: 3, color: "#c6a0ff", symbol: "◈" },
  { id: "switch", name: "Switch", role: "Grifter", power: 2, specialty: "social", bonus: 3, color: "#ff83c4", symbol: "♧" },
  { id: "rook", name: "Rook", role: "Wheelman", power: 3, specialty: "transit", bonus: 2, color: "#81dbff", symbol: "↯" },
  { id: "oracle", name: "Oracle", role: "Wildcard", power: 3, specialty: "wild", bonus: 1, color: "#ffe68a", symbol: "◎" },
];

export const SPECIALTY_LABELS: Record<Specialty | "wild", string> = {
  tech: "Tech", force: "Force", stealth: "Stealth", social: "Social", transit: "Transit", wild: "Any target",
};

const DISTRICTS: { name: string; district: string; specialty: Specialty }[][] = [
  [
    { name: "The Night Market", district: "LOWER EAST", specialty: "social" },
    { name: "Cipher Exchange", district: "DATA DISTRICT", specialty: "tech" },
    { name: "Obsidian Vault", district: "FINANCIAL CORE", specialty: "force" },
  ],
  [
    { name: "Skyline Courier", district: "SKYWAY 09", specialty: "transit" },
    { name: "Silk Syndicate", district: "OLD QUARTER", specialty: "stealth" },
    { name: "Mirage Casino", district: "ENTERTAINMENT ROW", specialty: "social" },
  ],
  [
    { name: "Ghost Server", district: "SECTOR 404", specialty: "tech" },
    { name: "Iron Convoy", district: "INDUSTRIAL BELT", specialty: "transit" },
    { name: "The Black Archive", district: "RESTRICTED ZONE", specialty: "stealth" },
  ],
  [
    { name: "Last Train Out", district: "TERMINAL 01", specialty: "transit" },
    { name: "Specter Mansion", district: "HIGH GARDENS", specialty: "stealth" },
    { name: "The Crown Vault", district: "CITY CENTER", specialty: "force" },
  ],
];

export function targetsForRound(round: number): Target[] {
  return (DISTRICTS[Math.max(0, Math.min(round - 1, TOTAL_ROUNDS - 1))]).map((target, id) => ({
    ...target, id, difficulty: [4, 6, 8][id] + Math.floor((round - 1) / 2),
    loot: [6000, 10000, 14000][id] + (round - 1) * 2000,
  }));
}

// Every occupied vault opens. Predicting the crowd is the only calculation.
export function vaultsForRound(round: number): Target[] {
  return ["Mint Vault", "Sky Vault", "Gold Vault"].map((name, id) => ({
    id, name, district: ["THE QUIET ONE", "THE MIDDLE ONE", "THE BIG ONE"][id],
    specialty: "tech" as const, difficulty: 0,
    loot: [6000, 10000, 14000][id] + (round - 1) * 2000,
  }));
}

export function operativeById(id: OperativeId) {
  return OPERATIVES.find((operative) => operative.id === id)!;
}

export function powerFor(id: OperativeId, target: Target) {
  const operative = operativeById(id);
  return operative.power + (operative.specialty === "wild" || operative.specialty === target.specialty ? operative.bonus : 0);
}

export function credits(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
