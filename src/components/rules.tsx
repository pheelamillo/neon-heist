import Link from "next/link";
import { ArrowRight, Coins, DoorOpen, MousePointer2, Skull, Trophy } from "lucide-react";

const rules = [
  { icon: MousePointer2, title: "1. Pick a vault", text: "Tap Mint, Sky, or Gold. The number on each vault is the loot inside. Your choice is secret. You don’t choose a character or calculate strength." },
  { icon: Coins, title: "2. Grab the loot", text: "Tap Grab loot to lock your choice. Alone at a vault? Take it all. Other players at the same vault? Split it equally. Every occupied vault opens." },
  { icon: Skull, title: "3. One optional steal", text: "Double Cross is your one steal for the whole game. Turn on Steal instead before submitting to take your vault’s whole payout. If two or more players steal at the same vault, the alarm sounds and nobody there gets loot. You can leave this off while learning." },
  { icon: Trophy, title: "4. Most loot wins", text: "Visit the Street Bank, Armored Train, Sky Bank, and Crown Vault: one setting each round, with more loot at every stop. Keep picking a vault and grabbing loot. Your own total is always visible; opponents’ totals stay hidden until the end. The biggest final total wins. Equal totals share the win." },
];
export function Rules() { return <div className="rules-grid">{rules.map(({ icon: Icon, title, text }) => <article className="rule" key={title}><span className="rule-icon"><Icon size={22}/></span><h3>{title}</h3><p>{text}</p></article>)}</div>; }
export function QuickRules() {
  return <section className="quick-rules"><div className="section-heading"><div><span className="eyebrow">THAT’S THE WHOLE IDEA</span><h2>Pick. Open. Get away.</h2></div><Link href="/rules" className="text-link">How to play <ArrowRight size={17}/></Link></div><div className="quick-grid">{[
    { icon: MousePointer2, title: "Tap a vault", text: "Pick one of the three. Go where you think others won’t." },
    { icon: DoorOpen, title: "Watch it open", text: "Alone? It’s all yours. Together? Share what’s inside." },
    { icon: Trophy, title: "Win the getaway", text: "Collect loot over four rounds. The biggest total wins." },
  ].map(({ icon: Icon, title, text }, index) => <article key={title}><span className="quick-icon"><Icon size={25}/></span><span className="quick-number">0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>;
}
