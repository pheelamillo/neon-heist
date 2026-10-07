import { ArrowDown, Play, Users, Timer, MonitorSmartphone } from "lucide-react";
import { Header, Footer } from "@/components/brand";
import { EntryForm } from "@/components/entry-form";
import { QuickRules } from "@/components/rules";
import { VaultPlayground } from "@/components/vault-scene";
import { VaultDemo } from "@/components/vault-demo";

export default function Home() {
  return <div className="site-shell new-game"><Header><span className="nav-status"><span className="status-dot"/> YOUR GETAWAY STARTS HERE</span></Header><main>
    <section className="hero"><div className="hero-copy"><div className="eyebrow">A LITTLE LUCK. A LITTLE MISCHIEF.</div><h1>Pick a vault.<br/><span>Grab the loot.</span></h1><p className="hero-description">Three vaults. Four rounds. One sneaky steal.<br/>Pick where to go. Most loot wins.</p><div className="hero-meta"><span><Users size={16}/> Solo or 2–8 friends</span><span><Timer size={16}/> Four quick rounds</span><span><MonitorSmartphone size={16}/> Any device</span></div><a href="#demo" className="demo-jump"><Play size={17} fill="currentColor"/> Show me how to play <span>14-second demo</span></a><div className="hero-vault"><VaultPlayground/><span className="hero-vault-label"><span className="status-dot"/> THE GOLD VAULT <span>$14,000 INSIDE</span></span></div></div>
      <aside className="hero-entry" id="play"><div className="entry-topline"><span>NEW HERE? TRY THE COMPUTER FIRST.</span><ArrowDown size={16}/></div><EntryForm/><p className="entry-under">Your friends pick in secret. Will you share a vault—or get one all to yourself?</p></aside>
    </section><QuickRules/><VaultDemo/>
  </main><Footer/></div>;
}
