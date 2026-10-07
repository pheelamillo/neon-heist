"use client";

import { useState } from "react";
import { Building2, Landmark, TrainFront, Crown, ArrowRight } from "lucide-react";
import { HEIST_STAGES, type HeistStage } from "@/lib/game/stages";
import { credits, vaultsForRound } from "@/lib/game/catalog";
import { VaultScene } from "./vault-scene";

const icons = { bank: Landmark, train: TrainFront, sky: Building2, gold: Crown };

export function StageBanner({ stage, preview = false }: { stage: HeistStage; preview?: boolean }) {
  const Icon = icons[stage.id];
  return <div className="stage-banner" style={{ "--stage-accent": stage.accent } as React.CSSProperties}>
    <span className="stage-icon"><Icon size={24}/></span><div><span className="eyebrow">{preview ? "TAKE A LOOK" : `HEIST ${stage.round} OF 4`} · {stage.tagline.toUpperCase()}</span><h3>{stage.name}</h3><p>{stage.description}</p></div>
  </div>;
}

export function StageTour() {
  const [index, setIndex] = useState(0);
  const [opened, setOpened] = useState<number | null>(null);
  const stage = HEIST_STAGES[index];
  return <section className="stage-tour" id="stages" aria-label="Preview the four stages">
    <div className="section-heading"><div><span className="eyebrow">YOUR FOUR STOPS</span><h2>A new place. Every round.</h2><p>Same easy move: pick a vault and grab loot. Each stop has more treasure.</p></div><a href="#play" className="text-link">Let’s play <ArrowRight size={17}/></a></div>
    <div className="stage-route" role="tablist" aria-label="Heist settings">{HEIST_STAGES.map((item, i) => {
      const Icon = icons[item.id];
      return <button type="button" key={item.id} id={`stage-tab-${item.id}`} role="tab" aria-selected={i === index} aria-controls="stage-preview" style={{ "--stage-accent": item.accent } as React.CSSProperties} onClick={() => { setIndex(i); setOpened(null); }} onKeyDown={(event) => {
        const next = event.key === "ArrowRight" ? (i + 1) % 4 : event.key === "ArrowLeft" ? (i + 3) % 4 : event.key === "Home" ? 0 : event.key === "End" ? 3 : null;
        if (next === null) return; event.preventDefault(); setIndex(next); setOpened(null); document.getElementById(`stage-tab-${HEIST_STAGES[next].id}`)?.focus();
      }} tabIndex={i === index ? 0 : -1}><span className="stage-route-number">{i + 1}</span><Icon size={24}/><strong>{item.name}</strong><small>{i === 3 ? "The grand finale" : `Round ${i + 1}`}</small></button>;
    })}</div>
    <div className="stage-preview" id="stage-preview" role="tabpanel" aria-labelledby={`stage-tab-${stage.id}`} tabIndex={0}>
      <StageBanner stage={stage} preview/><VaultScene stage={stage} vaults={vaultsForRound(stage.round)} selected={opened} open={opened === null ? [] : [opened]} onSelect={(id) => setOpened(opened === id ? null : id)}/>
      <div className="stage-preview-controls">{vaultsForRound(stage.round).map((vault) => <button type="button" key={vault.id} aria-label={`${opened === vault.id ? "Close" : "Open"} ${vault.name} preview`} aria-pressed={opened === vault.id} onClick={() => setOpened(opened === vault.id ? null : vault.id)}>{vault.name}<span>{credits(vault.loot)}</span></button>)}</div>
      <p className="stage-preview-note">Tap a vault to open it. This is a preview, so no loot is scored.</p>
    </div>
  </section>;
}
