import Link from "next/link";
import { ArrowUpRight, Diamond } from "lucide-react";

export function Brand() {
  return <Link href="/" className="brand" aria-label="Neon Heist home"><span className="brand-mark"><Diamond size={24} strokeWidth={2.5} /></span><span>NEON<span className="brand-light">HEIST</span></span></Link>;
}

export function Header({ children }: { children?: React.ReactNode }) {
  return <header className="site-header"><Brand /><nav aria-label="Main navigation">{children}<Link href="/rules" className="nav-link">The rules <ArrowUpRight size={15} /></Link></nav></header>;
}

export function Footer() {
  return <footer className="site-footer"><span>© {new Date().getFullYear()} NEON HEIST</span><span>ONE MORE GETAWAY?</span><Link href="/rules">How to play ↗</Link></footer>;
}
