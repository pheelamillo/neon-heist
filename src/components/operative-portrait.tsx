import { OPERATIVES } from "@/lib/game/catalog";
import type { OperativeId } from "@/lib/game/types";

export function OperativePortrait({ id, className = "" }: { id: OperativeId; className?: string }) {
  const index = OPERATIVES.findIndex((operative) => operative.id === id);
  return <div className={`operative-portrait ${className}`} role="img" aria-label={`${OPERATIVES[index].name}, cyberpunk ${OPERATIVES[index].role.toLowerCase()}`}
    style={{ backgroundPosition: `${(index % 3) * 50}% ${index < 3 ? 0 : 100}%` }}/>;
}
