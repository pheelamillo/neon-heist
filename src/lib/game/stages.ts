export const HEIST_STAGES = [
  { id: "bank", round: 1, name: "Street Bank", tagline: "Your first getaway", description: "Neon signs, city lights, and three steel vaults.", accent: "#67e7dd", metal: 0x5a687d, trim: 0xb9c9d9 },
  { id: "train", round: 2, name: "Armored Train", tagline: "Loot on the move", description: "Climb aboard. The city rushes past the cargo safes.", accent: "#ffac73", metal: 0x475466, trim: 0xc0ac8b },
  { id: "sky", round: 3, name: "Sky Bank", tagline: "Above the city", description: "Glass walls, glowing towers, and a bigger haul.", accent: "#b399ff", metal: 0x9aaec5, trim: 0xd6e8f5 },
  { id: "gold", round: 4, name: "Crown Vault", tagline: "The final heist", description: "A golden chamber. The biggest loot of the game.", accent: "#ffd273", metal: 0x9a7440, trim: 0xe1bf6a },
] as const;

export type HeistStage = typeof HEIST_STAGES[number];
export type StageId = HeistStage["id"];

// The room's authoritative round chooses the setting; this adds no game rules.
export function stageForRound(round: number): HeistStage {
  return HEIST_STAGES[Math.max(0, Math.min(HEIST_STAGES.length - 1, round - 1))];
}
