"use client";

import { useEffect, useState } from "react";
import { Coins, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { VaultScene } from "./vault-scene";
import { OperativePortrait } from "./operative-portrait";

const demoVault = [{ id: 1, name: "Sky Vault", loot: 10000 }];
const steps = [
  { title: "Pick a vault.", text: "You and Byte secretly choose the Sky Vault." },
  { title: "Make your getaway.", text: "Everyone has picked. The choices are revealed." },
  { title: "The door opens!", text: "This vault has $10,000 in fictional loot." },
  { title: "Share the treasure.", text: "Two players chose this vault. You each get $5,000." },
];

export function VaultDemo({ compact = false }: { compact?: boolean }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [steal, setSteal] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (step === steps.length - 1) setPlaying(false);
      else setStep(step + 1);
    }, 3500);
    return () => clearTimeout(timer);
  }, [step, playing]);
  function replay() { setSteal(false); setStep(0); setPlaying(true); }
  return <section id={compact ? undefined : "demo"} className={`vault-demo ${compact ? "compact-demo" : ""}`} aria-label="How to play demo">
    <div className="demo-heading"><div><span className="eyebrow"><Sparkles size={13}/> LEARN BY WATCHING</span><h2>One heist. In 14 seconds.</h2></div><button className="button secondary" onClick={() => playing ? setPlaying(false) : step === 3 ? replay() : setPlaying(true)}>{playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? "Pause demo" : step === 0 ? "Watch demo" : step === 3 ? "Replay demo" : "Continue demo"}</button></div>
    <div className={`demo-stage demo-step-${step}`}><VaultScene vaults={demoVault} selected={1} open={step >= 2 ? [1] : []} onSelect={() => { setStep(step >= 2 ? 0 : 2); setPlaying(false); }}/>
      <div className="demo-runners" aria-label="Example players"><div className="demo-runner"><OperativePortrait id="ghost"/><strong>You</strong><span>{step === 3 ? (steal ? "$10,000" : "$5,000") : "Ready"}</span></div><div className="demo-runner"><OperativePortrait id="switch"/><strong>Byte</strong><span>{step === 3 ? (steal ? "$0" : "$5,000") : "Ready"}</span></div></div>
      <span className="demo-loot"><Coins size={17}/> $10,000</span>
    </div>
    <div className="demo-lesson"><div className="lesson-number">{step + 1}</div><div><h3>{step === 3 && steal ? "Or use your one steal." : steps[step].title}</h3><p>{step === 3 && steal ? "Your Double Cross takes all $10,000. If both players steal, nobody gets loot." : steps[step].text}</p></div></div>
    <div className="demo-progress" aria-label="Demo steps">{steps.map((item, index) => <button key={item.title} aria-label={`Demo step ${index + 1}: ${item.title}`} aria-current={index === step ? "step" : undefined} onClick={() => { setStep(index); setPlaying(false); }}>{index + 1}<span>{["Pick", "Reveal", "Open", "Loot"][index]}</span></button>)}</div>
    {step === 3 && <div className="demo-experiment"><span>Try it:</span><button className={!steal ? "active" : ""} onClick={() => setSteal(false)}>Share the loot</button><button className={steal ? "active" : ""} onClick={() => setSteal(true)}>Use Double Cross</button></div>}
    <p className="demo-footnote">An example, not a live match. Play four rounds. Most loot wins.</p>
    {compact && <button className="text-link" onClick={replay}><RotateCcw size={14}/> Start the demo again</button>}
  </section>;
}
