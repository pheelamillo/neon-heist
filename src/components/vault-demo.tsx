"use client";

import { useEffect, useState } from "react";
import { Coins, Pause, Play, RotateCcw, Sparkles, Wallet } from "lucide-react";
import { VaultScene } from "./vault-scene";
import { OperativePortrait } from "./operative-portrait";
import { credits } from "@/lib/game/catalog";

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
  const [payoutRun, setPayoutRun] = useState(0);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (step === steps.length - 1) setPlaying(false);
      else setStep(step + 1);
    }, 3500);
    return () => clearTimeout(timer);
  }, [step, playing]);
  useEffect(() => {
    setProgress(0);
    if (step !== 3) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setProgress(1); return; }
    const started = performance.now();
    let frame = 0;
    function collect(now: number) {
      const elapsed = Math.min(1, (now - started) / 1600);
      setProgress(elapsed);
      if (elapsed < 1) frame = requestAnimationFrame(collect);
    }
    frame = requestAnimationFrame(collect);
    return () => cancelAnimationFrame(frame);
  }, [step, steal, payoutRun]);
  function goToStep(index: number) { setProgress(0); setSteal(false); setPayoutRun((run) => run + 1); setStep(index); setPlaying(false); }
  function changeSplit(value: boolean) { setProgress(0); setSteal(value); setPayoutRun((run) => run + 1); }
  function replay() { goToStep(0); setPlaying(true); }
  const myLoot = Math.round((steal ? 10000 : 5000) * progress);
  const byteLoot = steal ? 0 : Math.round(5000 * progress);
  const remaining = step === 3 ? 10000 - myLoot - byteLoot : 10000;
  const collected = step === 3 && progress === 1;
  return <section id={compact ? undefined : "demo"} className={`vault-demo ${compact ? "compact-demo" : ""}`} aria-label="How to play demo">
    <div className="demo-heading"><div><span className="eyebrow"><Sparkles size={13}/> LEARN BY WATCHING</span><h2>One heist. In 14 seconds.</h2></div><button className="button secondary" onClick={() => playing ? setPlaying(false) : step === 3 ? replay() : setPlaying(true)}>{playing ? <Pause size={16}/> : <Play size={16}/>} {playing ? "Pause demo" : step === 0 ? "Watch demo" : step === 3 ? "Replay demo" : "Continue demo"}</button></div>
    <div className={`demo-stage demo-step-${step}`}><VaultScene vaults={demoVault} selected={1} open={step >= 2 ? [1] : []} empty={collected ? [1] : []} onSelect={() => goToStep(step >= 2 ? 0 : 2)}/>
      <div className="demo-runners" aria-label="Example players"><div className="demo-runner"><OperativePortrait id="ghost"/><strong>You</strong><span>{step === 3 ? credits(myLoot) : "Ready"}</span></div><div className="demo-runner"><OperativePortrait id="switch"/><strong>Byte</strong><span>{step === 3 ? credits(byteLoot) : "Ready"}</span></div></div>
      <span className={`demo-loot ${collected ? "vault-emptied" : ""}`}><Coins size={17}/><strong>{credits(remaining)}</strong><small>{step === 3 ? "left in vault" : "inside vault"}</small></span>
      {step === 3 && !collected && <div className="demo-coin-transfers" key={`${payoutRun}:${steal}`} aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <Coins key={index} size={22} style={{ "--coin-direction": steal || index % 2 === 0 ? -1 : 1, "--coin-delay": `${Math.floor(index / 2) * .06}s` } as React.CSSProperties}/>)}</div>}
    </div>
    <div className="demo-lesson"><div className="lesson-number">{step + 1}</div><div><h3>{step === 3 && steal ? "Or use your one steal." : steps[step].title}</h3><p>{step === 3 && steal ? "Your Double Cross takes all $10,000. If both players steal, nobody gets loot." : steps[step].text}</p></div></div>
    <div className="demo-progress" aria-label="Demo steps">{steps.map((item, index) => <button key={item.title} aria-label={`Demo step ${index + 1}: ${item.title}`} aria-current={index === step ? "step" : undefined} onClick={() => goToStep(index)}>{index + 1}<span>{["Pick", "Reveal", "Open", "Loot"][index]}</span></button>)}</div>
    {step === 3 && <div className="demo-payout" role="region" aria-label="Demo payout" data-payout={collected ? "collected" : "collecting"} key={`${payoutRun}:${steal}`}><div className="demo-wallets"><div className="demo-wallet demo-wallet-you"><span><Wallet size={18}/> Your wallet</span><strong>{credits(myLoot)}</strong></div><div className="demo-wallet demo-wallet-byte"><span><Wallet size={18}/> Byte’s wallet</span><strong>{credits(byteLoot)}</strong></div></div><p role="status">{collected ? steal ? "You took all $10,000. Byte gets $0." : "Loot collected! $5,000 for you. $5,000 for Byte." : "Collecting the loot… watch it move into the wallets."}</p></div>}
    {step === 3 && <div className="demo-experiment"><span>Try it:</span><button className={!steal ? "active" : ""} aria-pressed={!steal} onClick={() => changeSplit(false)}>Share the loot</button><button className={steal ? "active" : ""} aria-pressed={steal} onClick={() => changeSplit(true)}>Use Double Cross</button></div>}
    <p className="demo-footnote">An example, not a live match. Play four rounds. Most loot wins.</p>
    {compact && <button className="text-link" onClick={replay}><RotateCcw size={14}/> Start the demo again</button>}
  </section>;
}
